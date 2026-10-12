/* Proves the relay guard: private hosts and non-media paths are refused, and a
   relay can never be pointed outside the configured provider or the import. */
import { assertRelayable, pinnedHosts } from '../server/src/live';
import { readStoredPlaylist } from '../server/src/providerRouter';

const blocked: string[] = [];
const try_ = (label: string, fn: () => unknown) => { try { fn(); } catch (e) { blocked.push(`${label}: ${e instanceof Error ? e.message : e}`); } };

try_('loopback', () => assertRelayable('http://127.0.0.1:8099/test-playlist.m3u'));
try_('lan', () => assertRelayable('http://192.168.1.10/live/x.ts'));
try_('link-local', () => assertRelayable('http://169.254.169.254/latest/meta-data'));
try_('non-media path', () => assertRelayable('http://evil.example/secret/config.json'));
try_('non-http scheme', () => assertRelayable('file:///etc/passwd'));

const okMedia = assertRelayable('http://evil.example/live/1.ts').host;
const stored = await readStoredPlaylist();
const hosts = [...(await pinnedHosts())];
const pinned = !hosts.includes('evil.example');
console.log(JSON.stringify({ blocked, allowedMediaHost: okMedia, pinnedHosts: hosts, foreignHostPinned: !pinned, channels: stored?.channels.length ?? 0 }, null, 2));
const pass = blocked.length === 5 && pinned && (stored?.channels.length ?? 0) > 0;
console.log(pass ? 'GUARD CHECK OK' : 'GUARD CHECK FAILED');
if (!pass) process.exit(1);
