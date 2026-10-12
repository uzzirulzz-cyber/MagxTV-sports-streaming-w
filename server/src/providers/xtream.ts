/* Xtream-Codes-compatible provider adapter.
   Point SPORTS_API_BASE_URL at YOUR OWN licensed panel. Categories are mapped
   onto the platform taxonomy with the group-name heuristics below, matching the
   way operator playlists are grouped. */
import { config } from '../config';
import { sportFromGroup } from '../sportMap';
import { buildCatalog, SPORTS } from './catalog';
import type { Catalog, Category, League, Match, SportId } from './catalog';
import type { ProviderResult } from './index';

export { sportFromGroup } from '../sportMap';

function apiUrl(action: string): string {
  const u = new URL(config.providerBaseUrl.replace(/\/+$/, '') + '/player_api.php');
  u.search = new URLSearchParams({ username: config.providerUser, password: config.providerPass, action }).toString();
  return u.toString();
}

async function pull(action: string): Promise<unknown[]> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  try {
    const res = await fetch(apiUrl(action), { signal: ctrl.signal, headers: { 'User-Agent': 'PlayBeatDigital/1.0' } });
    if (!res.ok) throw new Error(`provider responded ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } finally { clearTimeout(timer); }
}

interface XtCat { category_id: string | number; category_name: string }
interface XtStream { stream_id: string | number; name: string; stream_icon?: string; category_id: string | number }

const icon = (sport: SportId): string => SPORTS.find((s) => s.id === sport)?.icon ?? '📺';

export async function xtreamProvider(): Promise<ProviderResult> {
  const [cats, streams] = await Promise.all([
    pull('get_live_categories') as Promise<XtCat[]>,
    pull('get_live_streams') as Promise<XtStream[]>
  ]);
  const base = buildCatalog(Date.now());

  const categories: Category[] = cats.slice(0, 24).map((c, i) => {
    const sport = sportFromGroup(String(c.category_name || ''));
    return {
      id: `cat-${c.category_id}`, label: String(c.category_name || `Category ${i + 1}`), sport, icon: icon(sport),
      count: streams.filter((s) => String(s.category_id) === String(c.category_id)).length
    };
  });

  const leagues: League[] = cats.slice(0, 12).map((c) => {
    const sport = sportFromGroup(String(c.category_name || ''));
    return {
      id: `lg-${c.category_id}`, name: String(c.category_name || 'Competition'), sport,
      region: 'Provider listing', tier: 'Subscription',
      accent: SPORTS.find((s) => s.id === sport)?.accent ?? '#2d8cff', teams: [], matches: 0
    };
  });

  /* Channels come back as scheduled events; each is surfaced as a fixture so the
     operator immediately sees their own line-up. streamPath stays null — play
     URLs are minted per request by /api/player/source so credentials never ship
     to the client. */
  const matches: Match[] = streams.slice(0, 120).map((s, i) => {
    const league = leagues.find((l) => l.id === `lg-${s.category_id}`) ?? leagues[0];
    const sport = league?.sport ?? sportFromGroup(String(s.name || ''));
    return {
      id: `xt-${s.stream_id}`, sport, leagueId: league?.id ?? 'lg-unknown',
      leagueName: league?.name ?? 'Provider listing', region: 'Provider listing',
      home: { id: `xt-${s.stream_id}-h`, name: String(s.name || 'Channel'), short: 'LIVE', color: '#2d8cff' },
      away: { id: `xt-${s.stream_id}-a`, name: 'TBC', short: 'TBC', color: '#7b3cff' },
      status: 'upcoming', kickoff: new Date(Date.now() + (i - 4) * 45 * 60000).toISOString(),
      durationMin: 120, minute: 0, period: 'Scheduled', homeScore: 0, awayScore: 0, subscores: '',
      venue: 'Provider feed', channel: String(s.name || 'Channel'), premium: false, featured: i < 6,
      streamPath: null, thumb: base.matches.length ? base.matches[i % base.matches.length].thumb : '', viewers: '—'
    };
  });

  leagues.forEach((l) => { l.matches = matches.filter((m) => m.leagueId === l.id).length; });

  const catalog: Catalog = {
    demo: false, provider: 'xtream', generatedAt: new Date().toISOString(),
    leagues, matches, standings: {}, highlights: base.highlights, news: base.news, categories
  };
  return {
    catalog,
    status: {
      provider: 'xtream', demo: false, baseUrl: config.providerBaseUrl,
      message: `Connected to the configured provider: ${cats.length} categories, ${streams.length} live channels.`
    }
  };
}
