/* M3U / M3U8 playlist parser — the fallback importer alongside the Xtream API
   loader. Pure functions with no I/O, so it runs inside a queued worker job and
   can be exercised by scripts/m3u-selftest.ts.

   Supported syntax: #EXTM3U header (incl. url-tvg / x-tvg-url), #EXTINF with
   quoted and unquoted attributes, #EXTGRP group override, #EXTVLCOPT /
   #KODIPROP / #EXT-X-* passthrough lines, bare-URL lines, CRLF, blank lines. */
import type { SportId } from './providers/catalog';
import { sportFromGroup } from './sportMap';

export type StreamKind = 'hls' | 'mpegts' | 'mp4' | 'unknown';
export type Access = 'free' | 'subscription';

export interface M3uChannel {
  id: string; name: string; url: string; logo: string; group: string;
  tvgId: string; epgChannelId: string | null;
  kind: StreamKind; host: string; access: Access; sport: SportId;
}
export interface M3uGroup { name: string; count: number; free: number; sport: SportId }
export interface M3uStats {
  total: number; hls: number; mpegts: number; mp4: number; unknown: number;
  free: number; subscription: number; withLogo: number; withEpg: number;
  groups: number; skipped: number;
}
export interface M3uSourceInfo {
  looksLikeXtream: boolean; host: string | null; username: string | null;
  isGetPhp: boolean; outputExt: string | null; urlTvg: string | null;
}
export interface ParsedPlaylist {
  channels: M3uChannel[]; groups: M3uGroup[]; stats: M3uStats;
  source: M3uSourceInfo; warnings: string[];
}
export interface ParseOptions { allowlist?: string[]; maxChannels?: number }

const ATTR_RE = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
const FREE_HINT = /\b(free|public|open|freesports|demo)\b/i;

function quotedAttrs(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  ATTR_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ATTR_RE.exec(line))) out[m[1].toLowerCase()] = m[2];
  return out;
}
function looseAttrs(line: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const tok of line.split(/\s+/)) {
    const i = tok.indexOf('=');
    if (i <= 0) continue;
    const k = tok.slice(0, i).toLowerCase();
    if (k in out) continue;
    out[k] = tok.slice(i + 1).replace(/^"|"$/g, '');
  }
  return out;
}
/* quoted attributes win, because a logo URL can contain spaces */
const attrsOf = (line: string) => ({ ...looseAttrs(line), ...quotedAttrs(line) });

export function kindOf(url: string): StreamKind {
  const path = url.split('?')[0].toLowerCase();
  if (path.endsWith('.m3u8')) return 'hls';
  if (path.endsWith('.ts')) return 'mpegts';
  if (/\.(mp4|m4v|mkv|avi|webm)$/.test(path)) return 'mp4';
  return 'unknown';
}
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
function clean(s: string): string { return s.replace(/\s+/g, ' ').trim(); }

/** A channel is tagged free when its host is on the open-licence allow-list, or
    when its group/name says so. Everything else is treated as subscription. */
export function accessOf(name: string, group: string, host: string, allowlist: string[]): Access {
  if (allowlist.includes(host)) return 'free';
  if (FREE_HINT.test(group) || FREE_HINT.test(name)) return 'free';
  return 'subscription';
}

export function parsePlaylist(text: string, opts: ParseOptions = {}): ParsedPlaylist {
  const allowlist = opts.allowlist ?? [];
  const max = opts.maxChannels ?? 20000;
  const warnings: string[] = [];
  const channels: M3uChannel[] = [];
  const seen = new Set<string>();
  let urlTvg: string | null = null;
  let pending: { line: string; attrs: Record<string, string>; name: string; groupOverride?: string } | null = null;
  let skipped = 0;
  let sawHeader = false;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('#EXTM3U')) {
      sawHeader = true;
      const a = attrsOf(line);
      urlTvg = a['url-tvg'] ?? a['x-tvg-url'] ?? a['tvg-url'] ?? null;
      continue;
    }
    if (line.startsWith('#EXTINF')) {
      const comma = line.indexOf(',');
      const head = comma >= 0 ? line.slice(0, comma) : line;
      const title = comma >= 0 ? clean(line.slice(comma + 1)) : '';
      const a = attrsOf(head);
      pending = { line, attrs: a, name: title || clean(a['tvg-name'] ?? '') || 'Unnamed channel' };
      continue;
    }
    if (line.startsWith('#EXTGRP')) {
      if (pending) pending.groupOverride = clean(line.slice(line.indexOf(':') + 1));
      continue;
    }
    if (line.startsWith('#')) continue;            /* EXTVLCOPT, KODIPROP, comments */
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(line)) { skipped++; continue; }

    if (!pending) { skipped++; continue; }          /* a URL with no #EXTINF */
    if (channels.length >= max) { warnings.push(`Stopped at the ${max}-channel import cap; the playlist contains more.`); break; }

    let host = '';
    try { host = new URL(line).hostname; } catch { skipped++; pending = null; continue; }

    const a = pending.attrs;
    const group = clean(pending.groupOverride ?? a['group-title'] ?? '') || 'Ungrouped';
    const name = pending.name;
    const tvgId = clean(a['tvg-id'] ?? a['channel-id'] ?? '');
    const logo = clean(a['tvg-logo'] ?? a['logo'] ?? '');

    let id = 'c' + hash(line);
    let n = 1;
    while (seen.has(id)) id = 'c' + hash(line) + '-' + n++;
    seen.add(id);

    channels.push({
      id, name, url: line, logo, group, tvgId,
      epgChannelId: tvgId ? tvgId : null,
      kind: kindOf(line), host,
      access: accessOf(name, group, host, allowlist),
      sport: sportFromGroup(`${group} ${name}`)
    });
    pending = null;
  }

  if (!sawHeader) warnings.push('No #EXTM3U header found — the file may not be a playlist.');
  if (!channels.length) warnings.push('No playable entries were found in this playlist.');
  if (skipped) warnings.push(`${skipped} line(s) were skipped because they were not #EXTINF/URL pairs.`);

  const byGroup = new Map<string, M3uGroup>();
  for (const c of channels) {
    const g = byGroup.get(c.group) ?? { name: c.group, count: 0, free: 0, sport: c.sport };
    g.count += 1;
    if (c.access === 'free') g.free += 1;
    byGroup.set(c.group, g);
  }
  const groups = [...byGroup.values()].sort((a, b) => b.count - a.count);

  const probe = channels.find((c) => /get\.php|\/live\//i.test(c.url))?.url ?? channels[0]?.url ?? '';
  let sHost: string | null = probe ? new URL(probe).hostname : null;
  let sUser: string | null = null;
  let isGetPhp = false;
  let outputExt: string | null = null;
  try {
    const u = new URL(probe);
    isGetPhp = /\/get\.php$/i.test(u.pathname);
    sUser = u.searchParams.get('username');
    outputExt = u.searchParams.get('output') ?? u.searchParams.get('type');
  } catch { sHost = null; }

  return {
    channels,
    groups,
    stats: {
      total: channels.length,
      hls: channels.filter((c) => c.kind === 'hls').length,
      mpegts: channels.filter((c) => c.kind === 'mpegts').length,
      mp4: channels.filter((c) => c.kind === 'mp4').length,
      unknown: channels.filter((c) => c.kind === 'unknown').length,
      free: channels.filter((c) => c.access === 'free').length,
      subscription: channels.filter((c) => c.access === 'subscription').length,
      withLogo: channels.filter((c) => c.logo).length,
      withEpg: channels.filter((c) => c.tvgId).length,
      groups: groups.length,
      skipped
    },
    source: {
      looksLikeXtream: isGetPhp || /\/live\/[^/]+\/[^/]+\//.test(probe),
      host: sHost, username: sUser, isGetPhp, outputExt, urlTvg
    },
    warnings
  };
}

/** Playlist URLs very often carry credentials in the query string — mask them
    before anything is shown or logged. */
export function maskPlaylistUrl(url: string): string {
  try {
    const u = new URL(url);
    for (const k of ['username', 'password', 'pass', 'user', 'token', 'key']) {
      if (u.searchParams.has(k)) u.searchParams.set(k, '•••');
    }
    return u.toString();
  } catch { return url.replace(/(username|password|pass|token|key)=[^&\s]+/gi, '$1=•••'); }
}
