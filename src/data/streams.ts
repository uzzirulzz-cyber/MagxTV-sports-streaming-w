/* Only openly licensed / public test streams are configured out of the box.
   Operators replace these with their own licensed origin (see .env.example ->
   STREAM_ALLOWLIST). The player and the API both hard-refuse other hosts. */
export interface DemoStream { path: string; label: string; licence: string; requiresAuth: boolean }

export const DEMO_STREAMS: DemoStream[] = [
  { path: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8', label: 'Main Camera', licence: 'Mux public HLS test stream', requiresAuth: true },
  { path: 'https://test-streams.mux.dev/bbbAES/playlists/sample_aes/index.m3u8', label: 'Tactical Camera', licence: 'Big Buck Bunny (CC-BY 3.0, Blender Foundation) HLS', requiresAuth: true },
  { path: 'https://test-streams.mux.dev/tos_ismc/main.m3u8', label: 'Behind The Goal', licence: 'Tears of Steel (CC-BY 3.0, Blender Foundation) HLS', requiresAuth: true },
  { path: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', label: 'Highlights Feed', licence: 'Big Buck Bunny MP4 (CC-BY 3.0)', requiresAuth: false }
];

export const ALLOWED_HOSTS = ['test-streams.mux.dev', 'commondatastorage.googleapis.com'];

export function isAllowed(url: string): boolean {
  try { return ALLOWED_HOSTS.includes(new URL(url).hostname); } catch { return false; }
}
