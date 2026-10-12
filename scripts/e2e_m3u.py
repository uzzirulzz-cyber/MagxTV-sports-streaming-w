#!/usr/bin/env python3
"""End-to-end check for the M3U importer: worker job -> bucket -> router -> free tagging."""
import json, time, urllib.request, urllib.error, sys

API = "http://localhost:8795"
OK, FAIL = [], []

def call(method, path, body=None, token=None, expect=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(API + path, data=data, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(req, timeout=90) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:    return e.code, json.loads(raw or "{}")
        except Exception: return e.code, {"raw": raw}

def check(name, cond, detail=""):
    (OK if cond else FAIL).append(name)
    print(("  PASS  " if cond else "  FAIL  ") + name + (("  -> " + str(detail)[:220]) if detail else ""))

# ---------- 0. health + demo fallback before any import ----------
s, h = call("GET", "/api/health")
check("health ok", s == 200 and h.get("ok") is True, h)

s, pre = call("GET", "/api/admin/m3u")   # unauthenticated on purpose
check("admin m3u route requires auth", s in (401, 403), f"{s} {pre}")

# ---------- 1. login as the seeded admin ----------
s, r = call("POST", "/api/auth/login", {"email": "admin@magxtv.example", "password": "MagxAdmin#2026"})
tok = r.get("token")
check("admin login", s == 200 and bool(tok), s)

s, st0 = call("GET", "/api/admin/m3u", token=tok)
picked0 = st0.get("router", {}).get("picked")
check("router reports a source before the import (demo with an empty bucket)",
      (picked0 == "demo" and st0.get("stored") is None) or picked0 == "m3u",
      f"picked={picked0} stored={st0.get('stored') is not None}")

# ---------- 2. start the queued import job ----------
playlist_url = "http://127.0.0.1:8099/test-playlist.m3u"
s, r = call("POST", "/api/admin/m3u/import", {"url": playlist_url}, token=tok)
job = r.get("job") or {}
check("import accepted with a job id", s == 202 and bool(job.get("id")), f"{s} {r}")

job_id = job.get("id")
seen = []
for _ in range(60):
    s, jr = call("GET", f"/api/admin/m3u/job/{job_id}", token=tok)
    jb = jr.get("job") or {}
    seen.append((jb.get("state"), jb.get("progress"), jb.get("message")))
    if jb.get("state") in ("done", "error"):
        break
    time.sleep(0.15)

states = [x[0] for x in seen]
prog = [x[1] for x in seen]
print("  job progress:", prog)
check("job reached done", states and states[-1] == "done", seen[-1] if seen else None)
check("job reported staged progress", len(set(prog)) >= 3, prog)

res = (jb.get("result") or {})
stats = res.get("stats") or {}
check("worker wrote the parsed playlist to the bucket",
      bool(res.get("bucket", {}).get("key")) and res["bucket"]["size"] > 0, res.get("bucket"))

# ---------- 3. the parser's stats ----------
print("  stats:", json.dumps(stats))
check("channels parsed", stats.get("total", 0) >= 14, stats.get("total"))
check("groups parsed", stats.get("groups", 0) >= 5, stats.get("groups"))
check("HLS and MPEG-TS both classified", stats.get("hls", 0) > 0 and stats.get("mpegts", 0) > 0, stats)
check("tvg-logo attributes captured", stats.get("withLogo", 0) >= 6, stats.get("withLogo"))
check("tvg-id / EPG attributes captured", stats.get("withEpg", 0) >= 6, stats.get("withEpg"))
check("free vs subscription split", stats.get("free", 0) > 0 and stats.get("subscription", 0) > 0, stats)

# ---------- 4. channels come back with the exact attribute mapping ----------
s, ch = call("GET", "/api/admin/m3u/channels", token=tok)
first = (ch.get("channels") or [{}])[0]
print("  first channel:", json.dumps(first)[:300])
check("group-title mapped to a group", bool(first.get("group")), first.get("group"))
check("tvg-id mapped to tvgId", bool(first.get("tvgId")), first.get("tvgId"))
check("tvg-logo mapped to logo", str(first.get("logo", "")).startswith("http"), first.get("logo"))
check("access flag on every channel", all(c.get("access") in ("free", "subscription") for c in ch.get("channels", [])))
check("sport inferred from the group name",
      any(c.get("sport") == "cricket" for c in ch.get("channels", [])), sorted({c.get("sport") for c in ch.get("channels", [])}))

# ---------- 5. group + free filters ----------
s, gf = call("GET", "/api/admin/m3u/channels?free=1", token=tok)
check("free-only filter returns only free channels",
      s == 200 and all(c.get("access") == "free" for c in gf.get("channels", [])) and len(gf.get("channels", [])) > 0,
      len(gf.get("channels", [])))
s, gq = call("GET", "/api/admin/m3u/channels?group=Cricket", token=tok)
check("group filter works", s == 200 and all(c.get("group") == "Cricket" for c in gq.get("channels", [])), gq.get("total"))

# ---------- 6. status: router chain + bucket listing ----------
s, st = call("GET", "/api/admin/m3u", token=tok)
check("router now picks m3u over demo", st.get("router", {}).get("picked") == "m3u", st.get("router"))
att = st.get("router", {}).get("attempts", [])
check("router reports which source served the request", any(a.get("source") == "m3u" and a.get("ok") for a in att), att)
check("bucket lists the stored objects", st.get("bucket", {}).get("count", 0) >= 1 and bool(st.get("bucket", {}).get("objects")), st.get("bucket", {}).get("objects"))
check("playlist URL stored masked, credentials hidden",
      st.get("playlistUrl") is None or "•••" in str(st.get("playlistUrl")) or "password=" not in str(st.get("playlistUrl")),
      st.get("playlistUrl"))

# ---------- 7. viewer-facing catalogue routes through the same router ----------
s, cat = call("GET", "/api/broadcast/catalog", token=tok)
check("viewer catalogue served from the playlist",
      s == 200 and cat.get("source") == "m3u" and cat.get("demo") is False, f"{s} {str(cat)[:150]}")
check("viewer channels carry the free tag",
      all(c.get("access") in ("free", "subscription") for c in cat.get("channels", [])), None)

# ---------- 8. the sports-data adapter falls back to the playlist too ----------
s, cat2 = call("GET", "/api/catalog")
prov = (cat2.get("status") or {}).get("provider")
check("provider adapter serves m3u as the fallback", prov == "m3u", (cat2.get("status") or {}).get("message"))

# ---------- 9. SSRF guard still refuses a foreign host on the segment relay ----------
import base64
foreign = base64.urlsafe_b64encode(b"http://evil.example/seg.ts").decode().rstrip("=")
s, seg = call("GET", f"/api/live/seg?u={foreign}&t={tok}")
check("segment relay refuses a host outside the provider", s == 403, f"{s} {seg}")

print("\nRESULT: %d passed, %d failed" % (len(OK), len(FAIL)))
if FAIL:
    print("FAILED:", FAIL)
    sys.exit(1)
