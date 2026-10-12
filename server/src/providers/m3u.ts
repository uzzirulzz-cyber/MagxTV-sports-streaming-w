/* M3U playlist adapter — the fallback that runs when the Xtream API loader is
   not configured or cannot be reached. It reads the playlist the importer
   worker wrote to the playlists bucket and projects it onto the platform's
   own Catalog shape, so every page keeps working. */
import { readStoredPlaylist } from '../providerRouter';
import type { ProviderStatus } from '../types';
import { buildCatalog } from './catalog';
import type { Catalog, Highlight, League, Match, SportId, Team } from './catalog';

const initials = (name: string): string => {
  const w = name.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  if (!w.length) return 'TV';
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[w.length - 1][0]).toUpperCase();
};
const team = (name: string): Team => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, short: initials(name), color: '#2d8cff' });

export interface M3uProviderResult { catalog: Catalog; status: ProviderStatus }

export async function m3uProvider(): Promise<M3uProviderResult> {
  const stored = await readStoredPlaylist();
  if (!stored || stored.channels.length === 0) throw new Error('No M3U playlist has been imported yet.');
  const base = buildCatalog(Date.now());

  /* One league per playlist group, biggest first. */
  const sorted = [...stored.groups].sort((a, b) => b.count - a.count);
  const leagues: League[] = sorted.slice(0, 18).map((g) => {
    const inGroup = stored.channels.filter((c) => c.group === g.name);
    const accent = { football: '#c8ff2e', cricket: '#19c3ff', basketball: '#ff9f45', tennis: '#b66bff', motorsport: '#ff3d5e' }[g.sport as SportId] ?? '#2d8cff';
    return {
      id: `m3u-${g.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name: g.name || 'Imported group',
      sport: g.sport,
      region: 'Playlist import',
      tier: `${g.count} channel${g.count === 1 ? '' : 's'}`,
      accent,
      teams: inGroup.slice(0, 6).map((c) => team(c.name)),
      matches: 0
    };
  });

  /* Live channels become watchable match cards: the group plays the away side. */
  const matches: Match[] = stored.channels.slice(0, 120).map((c, i) => {
    const lg = leagues.find((l) => l.name === c.group) ?? leagues[0];
    const sport: SportId = c.sport as SportId;
    return {
      id: c.id,
      sport,
      leagueId: lg?.id ?? 'm3u-import',
      leagueName: lg?.name ?? 'Playlist import',
      region: 'Playlist import',
      home: team(c.name),
      away: team(c.group || 'Live TV'),
      status: 'live' as const,
      kickoff: new Date(Date.now() - (i % 40) * 60_000).toISOString(),
      durationMin: 120,
      minute: i % 90,
      period: 'LIVE',
      homeScore: 0,
      awayScore: 0,
      subscores: c.access === 'free' ? 'Free to watch' : 'Subscription',
      venue: `${c.kind.toUpperCase()} · ${c.host}`,
      channel: c.name,
      premium: c.access !== 'free',
      featured: i < 6,
      streamPath: c.id,
      thumb: base.matches[i % base.matches.length]?.thumb ?? '',
      viewers: String(400 + ((i * 137) % 9000))
    };
  });
  leagues.forEach((l) => { l.matches = matches.filter((m) => m.leagueId === l.id).slice(0, 20).length; });

  const highlights: Highlight[] = stored.channels.slice(0, 6).map((c, i) => ({
    id: `hl-${c.id}`, title: `${c.name} — live now`, sport: c.sport as SportId, league: c.group || 'Playlist import',
    duration: 'LIVE', views: String(1200 + i * 310), published: new Date().toISOString(),
    thumb: base.highlights[i % base.highlights.length]?.thumb ?? '', streamPath: c.id
  }));

  const categories = stored.groups.map((g) => ({
    id: `m3u-${g.name}`, label: g.name, sport: g.sport as SportId, icon: '📺', count: g.count
  }));

  return {
    catalog: {
      demo: false, provider: 'm3u', generatedAt: new Date().toISOString(),
      leagues, matches, highlights, news: base.news, categories, standings: {}
    },
    status: {
      provider: 'm3u', demo: false, baseUrl: stored.source.host ?? '',
      message: `Serving ${stored.channels.length} channels in ${stored.groups.length} groups from the imported M3U playlist (${stored.importedAt}).`
    }
  };
}
