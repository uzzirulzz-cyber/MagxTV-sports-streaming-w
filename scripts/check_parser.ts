/* Proves the parser maps #EXTM3U / #EXTINF attributes onto the shared types. */
import fs from 'node:fs';
import { parsePlaylist, maskPlaylistUrl, kindOf, accessOf } from '../server/src/m3u';

const text = fs.readFileSync('/tmp/m3u_test/test-playlist.m3u', 'utf8');
const p = parsePlaylist(text, { allowlist: ['test-streams.mux.dev', 'commondatastorage.googleapis.com'], maxChannels: 20000 });
const c = p.channels.find((x) => x.tvgId === 'sky.f1')!;
const out = {
  urlTvg: p.source.urlTvg,
  first: { name: c.name, group: c.group, tvgId: c.tvgId, logo: c.logo, epgChannelId: c.epgChannelId, kind: c.kind, host: c.host, access: c.access, sport: c.sport },
  stats: p.stats,
  warnings: p.warnings,
  masked: maskPlaylistUrl('http://panel.test:8080/get.php?username=3fa35bc1&password=supersecret&type=m3u_plus&output=hls'),
  kindOf: [kindOf('http://x/a.m3u8'), kindOf('http://x/a.ts'), kindOf('http://x/a.mp4')],
  accessOf: [accessOf('Mux Free Test', 'Free Sports', 'test-streams.mux.dev', []), accessOf('Sky F1', 'Motorsport', 'panel.test', [])]
};
console.log(JSON.stringify(out, null, 2));
const ok = p.source.urlTvg === 'http://epg.example-provider.test/xmltv.xml'
  && c.group === 'Motorsport' && c.tvgId === 'sky.f1' && c.logo.endsWith('/101.png')
  && c.epgChannelId === 'sky.f1' && c.kind === 'hls' && c.sport === 'motorsport'
  && !out.masked.includes('supersecret') && !out.masked.includes('3fa35bc1')
  && (out.masked.includes('\u2022') || out.masked.includes('%E2%80%A2'))
  && p.stats.total === 19 && p.stats.groups === 17 && p.stats.free === 3
  && p.stats.hls === 7 && p.stats.mpegts === 10 && p.stats.mp4 === 2 && p.stats.unknown === 0 && p.stats.skipped === 0;
console.log(ok ? 'PARSER CHECK OK' : 'PARSER CHECK FAILED');
if (!ok) process.exit(1);
