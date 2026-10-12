/* The M3U import worker. Fetch and parse run as a queued job so a huge playlist
   cannot block the API; the parsed result is written to the playlists bucket and
   only then does the router start serving it. */
import { config } from './config';
import { queue } from './queue';
import { parsePlaylist, maskPlaylistUrl, type ParsedPlaylist } from './m3u';
import { getPlaylistUrl, setPlaylistUrl } from './providerConfig';
import { sharedBucket, PLAYLISTS } from './storage';

export interface ImportResult {
  ok: boolean; importedAt: string; url: string; stats: ParsedPlaylist['stats'];
  groups: ParsedPlaylist['groups']; warnings: string[]; source: ParsedPlaylist['source'];
  bucket: { driver: string; key: string; size: number };
}
export const MAX_PLAYLIST_BYTES = 25 * 1024 * 1024;

/** Public user agents get blocked by some hosts, so state who we are. */
const UA = 'MagxTV/1.0 (+m3u-importer)';

export function startImport(url: string, allowlist: string[]) {
  const clean = String(url).trim();
  return queue.enqueue<ImportResult>('m3u-import', `Import M3U — ${maskPlaylistUrl(clean)}`, async (report) => {
    report(5, 'Validating the playlist URL…');
    let parsedUrl: URL;
    try { parsedUrl = new URL(clean); } catch { throw new Error('That does not look like a valid playlist URL.'); }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') throw new Error('The playlist URL must be http:// or https://.');

    report(20, 'Downloading the playlist…');
    const res = await fetch(parsedUrl, { signal: AbortSignal.timeout(60_000), headers: { 'User-Agent': UA, Accept: 'audio/x-mpegurl, application/vnd.apple.mpegurl, text/plain, */*' } });
    if (!res.ok) throw new Error(`The playlist host answered HTTP ${res.status}.`);
    const len = Number(res.headers.get('content-length') ?? 0);
    if (len && len > MAX_PLAYLIST_BYTES) throw new Error(`That playlist is ${(len / 1048576).toFixed(1)} MB, above the ${MAX_PLAYLIST_BYTES / 1048576} MB import limit.`);
    const text = await res.text();
    if (text.length > MAX_PLAYLIST_BYTES) throw new Error(`That playlist is ${(text.length / 1048576).toFixed(1)} MB, above the ${MAX_PLAYLIST_BYTES / 1048576} MB import limit.`);

    report(55, 'Parsing channels and groups…');
    const parsed = parsePlaylist(text, { allowlist, maxChannels: 20000 });

    report(80, 'Writing the parsed playlist to the bucket…');
    const body = JSON.stringify({ importedAt: new Date().toISOString(), stats: parsed.stats, warnings: parsed.warnings, source: parsed.source, groups: parsed.groups, channels: parsed.channels });
    const b = sharedBucket(PLAYLISTS);
    const obj = await b.put('latest.json', body, 'application/json');
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await b.put(`archive/${stamp}-${parsed.stats.total}.json`, body, 'application/json');

    setPlaylistUrl(clean);
    report(100, `Imported ${parsed.stats.total} channels in ${parsed.groups.length} groups.`);
    return {
      ok: true, importedAt: new Date().toISOString(), url: maskPlaylistUrl(clean),
      stats: parsed.stats, groups: parsed.groups, warnings: parsed.warnings, source: parsed.source,
      bucket: { driver: b.driver, key: obj.key, size: obj.size }
    };
  });
}

/* Re-import whatever URL is already saved — used by the admin Refresh button. */
export function refreshImport(allowlist: string[]) {
  const url = getPlaylistUrl();
  if (!url) return null;
  return startImport(url, allowlist);
}
export const allowlistForImport = () => config.streamAllowlist;
