# PlayBeat Digital — Sports Streaming Platform

A full-stack sports media platform: **React + TypeScript + Vite** front end, **Express + PostgreSQL** API,
JWT/bcrypt authentication with `user` / `admin` roles, a configurable **sports-data provider adapter**,
and an **HLS.js video player that only plays sources on an explicit allow-list**.

---

## 1. Quick start

```bash
npm install

# Option A — full stack (PostgreSQL + API + built front end)
cp .env.example .env          # then edit .env
npm run db:migrate            # schema + seed users (idempotent)
npm run build                 # typecheck + production build into dist/
npm start                     # API + built app on http://localhost:8787

# Option B — front-end dev with hot reload
npm run dev                   # Vite on http://localhost:5173
npm run api                   # Express API on http://localhost:8787 (separate terminal)
BASE_URL note: set VITE_API_BASE_URL=http://localhost:8787 in .env for this mode.
```

With **no `DATABASE_URL`** the API transparently uses an in-memory store, and with **no
`VITE_API_BASE_URL`** the front end serves its bundled demo catalogue from `localStorage`.
Everything stays usable — every payload is flagged `demo: true` and the UI shows a **DEMO DATA** badge.

### Seed credentials

| Role  | Email                   | Password        | Plan     |
|-------|-------------------------|-----------------|----------|
| Admin | `admin@playbeat.digital`  | `PlayBeatAdmin#2026`| premium  |
| User  | `demo@playbeat.digital`   | `PlayBeatDemo#2026` | standard |

Both are created by `npm run db:migrate` (PostgreSQL) or `seedMemory()` / `ensureSeed()` (demo mode),
and are offered as one-click logins on the **Sign in** page. **Change them before any public deployment.**

---

## 2. Environment variables (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8787` | API port |
| `DATABASE_URL` | *(empty)* | `postgresql://user:pass@host:5432/playbeat-digital`. Empty ⇒ in-memory store |
| `JWT_SECRET` | dev fallback | **Set a long random value in production** |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `SPORTS_PROVIDER` | `mock` | `mock` \| `xtream` |
| `SPORTS_API_BASE_URL` | *(empty)* | Base URL of **your own licensed** panel/API |
| `SPORTS_API_USER` / `SPORTS_API_PASS` | *(empty)* | Provider credentials — **server-side only, never shipped to the browser** |
| `STREAM_ALLOWLIST` | `test-streams.mux.dev,commondatastorage.googleapis.com` | Comma-separated hosts allowed to play. **Anything else is refused.** |
| `CORS_ORIGINS` | `http://localhost:5173,http://localhost:4173` | Allowed browser origins |
| `VITE_API_BASE_URL` | *(empty)* | Front-end API base; empty ⇒ bundled demo catalogue |

---

## 3. Sports data provider adapter

`server/src/providers/index.ts` selects the integration at runtime:

* **`mock`** — deterministic generator (`providers/catalog.ts`): 18 competitions across football, cricket,
  basketball, tennis and motorsport with fixtures, live scores, tables, highlights and news. Every
  response carries `demo: true`, surfaced in the UI as the **DEMO DATA** badge.
* **`xtream`** — Xtream-Codes-compatible adapter (`providers/xtream.ts`). Categories and live channels are
  mapped onto the platform taxonomy by group-name heuristics; credentials stay in server env vars, and
  play URLs are resolved per request by `GET /api/player/source/:matchId` so they never reach the client.

Add your own integration by exporting a `ProviderResult` and registering it in the same switch.

### Streaming policy

Only **openly licensed** sources ship with this project: Mux's public HLS test stream, Blender Foundation's
*Big Buck Bunny* / *Tears of Steel* (CC-BY 3.0) and a public-domain MP4 sample. The player and the API both
hard-refuse any host outside `STREAM_ALLOWLIST`, and the API returns `403 Playback refused: …` otherwise.
Point `SPORTS_API_BASE_URL` and `STREAM_ALLOWLIST` at **your own licensed origin** to go live.

---

## 4. Pages (all real, no placeholders)

| Route | Page |
|---|---|
| `/` | Home — cinematic hero, live now, featured leagues, upcoming fixtures, news sidebar |
| `/live` | Live Sports — sport/filter/sort controls, live scoreboard, match grid |
| `/football` `/cricket` `/basketball` `/tennis` `/motorsports` | Sport hubs with matches / table / fixtures tabs |
| `/highlights` | Highlights library with sport filter and search |
| `/schedule` | Schedule — KPI strip, day/list views, favourites-only toggle |
| `/search?q=` | Search across matches, highlights and competitions |
| `/watch/:id` | Watch Match — HLS player, stats, line-ups, commentary, head-to-head, also-live |
| `/favorites` | Saved matches |
| `/profile` | Account, KPIs, notifications, playback preferences |
| `/admin` | Admin dashboard (role-gated): overview, users & roles, catalogue, stream policy |
| `/login` | Sign in / register with validation and demo quick-logins |
| `/credits` | Image credits, stream licences, integration notes |

## 5. API surface

```
GET    /api/health                        service + database + provider status
GET    /api/catalog                       fixtures, leagues, tables, highlights, news (+ demo flag)
GET    /api/provider/status               which integration is live
GET    /api/player/source/:matchId        allow-list-checked playback sources
POST   /api/auth/register                 name + email + password (bcrypt, min 8 chars)
POST   /api/auth/login                    → { user, token }
GET    /api/auth/me                       current user (Bearer token)
GET    /api/favorites                     list
POST   /api/favorites/:matchId            add
DELETE /api/favorites/:matchId            remove
GET    /api/notifications                 list
POST   /api/notifications/read            mark one / all read
GET    /api/admin/users                   role: admin
PATCH  /api/admin/users/:id               role: admin — change role / plan
GET    /api/admin/overview                role: admin — KPIs + stream policy
```

## 6. Screenshots

`npm run shot` (server running on 8787) captures every route at desktop and mobile widths into `shots/`
using Playwright — this is how the delivered screenshots were produced.

## 7. Licensing

All photography is public-domain / CC (PickPik, Freerange Stock, Flickr, Stockvault, Public Domain
Pictures, PICRYL) and credited on `/credits` and in the footer. **No league or club logos are used** —
team crests are generated from team initials and colours. Demo fixtures use fictional team names.

---

## 8. Live TV — connecting your own provider

The platform ships **no** channels, credentials or scraped sources. The demo catalogue is
invented data. To stream real channels you connect a provider **you are licensed to use**:

1. Run the API (`npm start`) and open **`/connect`** (nav → *Live TV*).
2. Enter the provider host, username and password. They are `POST`ed once to **your own API
   server**, verified against the panel, and held only in that server process's **in-memory
   token map for 6 hours**; the browser keeps the session in `localStorage` so a refresh does
   not log you out. Nothing is written into the source tree, `.env.example` or the built bundle.
3. The channel browser lists `get_live_categories` and `get_live_streams`, with search and
   category filters (first 240 rendered).
4. Playback goes through the relay, never the browser: `/api/live/hls/:id.m3u8` for HLS
   (`hls.js`), falling back to `/api/live/ts/:id.ts` for raw MPEG-TS (`mpegts.js`). Playlist
   child URIs are rewritten back through `/api/live/seg`.

### Why a relay instead of direct playback

* **Mixed content** — the panel is usually plain `http://`; a page served over https would block it.
  The relay is same-origin, so this cannot happen.
* **CORS** — the panel sends no CORS headers, so a direct browser fetch fails. The relay is server-side.
* **Credentials** — the browser never learns the origin URL, so the password never appears in
  dev-tools, a referrer header or a copied channel link.

**Security guardrails** — the relay refuses anything else: private/loopback addresses are never
relayed (SSRF guard), only media paths are accepted, and a segment whose host differs from the
connected provider returns `403`. Credentials entered at runtime are **yours**; the app holds no
third-party secrets.

### Troubleshooting

| Symptom | Meaning |
|---|---|
| `Could not reach the provider` | Wrong host/port, or the panel is firewalled off from your server |
| `subscription as "…"` at connect | The panel reports the account as expired or disabled |
| `switching to raw MPEG-TS` | The channel has no HLS playlist — mpegts.js takes over automatically |
| `Session expired` | The 6-hour server session lapsed — reconnect |
| Channel stalls | Often the provider's simultaneous-connection cap, not the app |

---

## 9. Admin → Broadcast (Xtream provider control)

Sign in as an administrator and open **Admin → Broadcast**. This is where the operator
obtains, fetches and loads the live provider that the whole site broadcasts:

1. **Host / Username / Password** — an Xtream-Codes compatible `player_api.php` endpoint.
   `http://` is fine, because playback is relayed by this server.
2. **Test connection** — verifies the credentials against the panel *without* saving, and
   reports subscription status, days remaining, expiry and the connection cap.
3. **Obtain & save broadcast** — re-verifies, then stores the provider **server-side**
   (`provider_config` in PostgreSQL, or the API process's memory when no database is set).
   The password is returned to the panel only as a mask (`••••••`) plus its length; leaving
   the field blank keeps the stored secret, so an operator never has to retype it.
4. **Fetch & load channels** — pulls `get_live_categories` + `get_live_streams`, shows the
   real group names with per-category counts, and loads up to 2,000 channels (first 300 shown,
   searchable). **Probe** on any channel opens its playlist through the relay and reports
   HTTP status, whether it is HLS or raw MPEG-TS, variant and segment counts.
5. **Disconnect provider** — deletes the stored configuration.

Once configured, the header strip on every page reads **LIVE PROVIDER CONNECTED**, and
signed-in viewers get the roster at **`/channels`** (nav → *Channels*). Viewers receive a
30-minute playback grant that contains no credentials: the relay looks the provider up from
the server-side configuration on each request, so rotating the provider invalidates old grants.

```
GET    /api/admin/provider            current provider (password masked)      role: admin
POST   /api/admin/provider/test       verify without saving                    role: admin
POST   /api/admin/provider/connect    obtain → verify → save                  role: admin
DELETE /api/admin/provider            remove the stored provider               role: admin
GET    /api/admin/provider/channels   fetch & load channels + categories       role: admin
GET    /api/admin/provider/probe/:id  what the panel actually serves for a channel
GET    /api/broadcast/catalog         viewer roster (signed in)
POST   /api/broadcast/token           30-minute playback grant (signed in)
```

> **Security**: the provider password is stored in plain text so the panel can reconnect
> unattended. Encrypt it at rest or move it to a secrets manager before production, and keep
> database access restricted. Credentials entered here are **yours**; the repository ships none.

## 10. M3U playlist importer (fallback to the Xtream API loader)

If no Xtream API panel is configured — or the configured one cannot be reached — the
provider router can serve channels from an M3U/M3U8 playlist that an operator imports.

* **Admin → Broadcast → M3U playlist importer** (or `POST /api/admin/m3u/import` with `{ "url": "…" }`)
  hands the URL to the server. The fetch + parse runs as a **queued worker job**, so the request
  returns `202` immediately and the panel polls `GET /api/admin/m3u/job/:id` for progress.
* The parsed playlist is persisted through the **storage bucket** abstraction
  (`buckets/playlists/latest.json`, plus a timestamped copy under `archive/`) and only then does the
  router start serving it. `GET /api/admin/m3u` returns the provider chain, bucket listing and job depth.
* `GET /api/admin/m3u/channels?group=&q=&free=1` browses the imported list;
  `POST /api/admin/m3u/refresh` re-fetches the saved URL; `DELETE /api/admin/m3u` removes the import.
* Parsed attributes map onto `src/lib/types.ts`: `tvg-id` → `tvgId`/`epgChannelId`, `tvg-logo` → `logo`,
  `group-title` → `group`, `url-tvg`/`x-tvg-url` → `source.urlTvg`, and the URL extension decides the
  stream kind (HLS / MPEG-TS / MP4). Groups are matched to a sport via `server/src/sportMap.ts`.
* Channels whose host is on the open-licence allow-list, or whose name/group says free/public/demo,
  are tagged **FREE**; everything else is tagged **SUB**. The viewer page `/channels` and the admin
  browser both show the badge and offer a "free to watch only" filter.
* Import limits (download size and channel cap) are enforced server-side and displayed in the panel.
  The full playlist URL is stored **masked**; upstream URLs are never sent to the browser — playback
  goes through the same-origin relay, which re-checks the host against the pinned provider hosts.
* Import only playlists you are authorised to use. Nothing is bundled or scraped by this repository.

Reproducible checks: `npx tsx scripts/check_parser.ts` (attribute mapping + stats),
`npx tsx scripts/check_guard.ts` (relay/SSRF guard) and `python3 scripts/e2e_m3u.py`
(import job → bucket → router → free tagging) against a running API.

## 11. Boot experience (startup sequence)

`src/components/BootScreen.tsx` is the premium startup sequence: a centred card with an animated
logo reveal, a staged progress list and a recessed status note.

* **Real signals, not a fake timer.** The five stages advance on actual readiness: webfonts
  (`document.fonts.ready`, capped at 1.5 s), the provider-status response (`statusReady` from
  `AppContext`), the catalogue request settling (`loading` → false) and session restore (`ready`).
  The index is monotonic, so it never regresses or overshoots.
* **Offline / API failure.** `navigator.onLine` plus the `online`/`offline` events, together with the
  catalogue error, switch the card into a warning note that offers **Try again** (`refresh()`) and
  **Continue to PlayBeat Digital**. The interface behind keeps working on the labelled demo catalogue.
* **Reduced motion.** `prefers-reduced-motion: reduce` disables the mark reveal, ring sweep, shimmer
  and pulse in CSS and collapses the JS settle delays to zero.
* **No layout shift.** The overlay is a fixed layer rendered alongside the routes, so the app shell is
  already laid out behind it; on the fade it is simply unmounted. Page scroll is locked only while it
  is visible.
* **Once per session.** `sessionStorage['pbd.boot.played']` is set on hand-over.
* **Review flags.** `?boot=1` holds it open, `?boot=0` skips it, `?stage=0-4` freezes a stage
  (used by `scripts/shot_boot.mjs` for deterministic captures). Esc or **Skip intro** dismisses it.

Capture the sequence with `node scripts/shot_boot.mjs` (desktop, mobile and the aborted-request
degraded state) once the API is serving the built `dist/`.
