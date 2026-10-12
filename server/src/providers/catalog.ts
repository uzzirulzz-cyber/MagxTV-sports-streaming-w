import type { Catalog, Category, Highlight, League, Match, NewsItem, SportId, StandingRow, Team } from '../../../src/lib/types';

export type { Catalog, Category, Highlight, League, Match, NewsItem, SportId, StandingRow, Team } from '../../../src/lib/types';
import { IMG } from '../images';

export const DEMO = true;
export const PROVIDER = 'mock';

export interface SportMeta {
  id: SportId; label: string; plural: string; icon: string; tagline: string;
  accent: string; hero: string; tableTitle: string; tableKind: 'standings' | 'points' | 'conference' | 'rankings' | 'drivers';
}
export const SPORTS: SportMeta[] = [
  { id: 'football', label: 'Football', plural: 'Football', icon: '⚽', accent: '#c8ff2e', hero: IMG.footballHero, tableTitle: 'League Standings', tableKind: 'standings', tagline: 'Every match night, from the first whistle to the final replay.' },
  { id: 'cricket', label: 'Cricket', plural: 'Cricket', icon: '🏏', accent: '#19c3ff', hero: IMG.cricketPacked, tableTitle: 'Points Table', tableKind: 'points', tagline: 'Tests, ODIs and T20 nights with ball-by-ball swing.' },
  { id: 'basketball', label: 'Basketball', plural: 'Basketball', icon: '🏀', accent: '#ff9f45', hero: IMG.basketballArena, tableTitle: 'Conference Table', tableKind: 'conference', tagline: 'Regular season pace, playoff intensity, every night.' },
  { id: 'tennis', label: 'Tennis', plural: 'Tennis', icon: '🎾', accent: '#b66bff', hero: IMG.tennisCourt, tableTitle: 'Tour Rankings', tableKind: 'rankings', tagline: 'Grand Slam courts and centre-court drama.' },
  { id: 'motorsport', label: 'Motorsports', plural: 'Motorsport', icon: '🏎️', accent: '#ff3d5e', hero: IMG.f1Track, tableTitle: 'Drivers Championship', tableKind: 'drivers', tagline: 'Lights out, wheel-to-wheel, every race weekend.' }
];
export const SPORT_BY_ID = SPORTS.reduce<Record<string, SportMeta>>((a, s) => (a[s.id] = s, a), {});

const initials = (name: string): string => {
  const w = name.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  if (!w.length) return 'TV';
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[w.length - 1][0]).toUpperCase();
};
const T = (name: string, color: string): Team => ({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, short: initials(name), color });

const LEAGUE_DEFS: { id: string; name: string; sport: SportId; region: string; tier: string; accent: string; teams: [string, string][] }[] = [
  { id: 'epl', name: 'Premier League', sport: 'football', region: 'England', tier: 'Tier 1', accent: '#7b3cff', teams: [['Northside United', '#e11d2e'], ['Riverside FC', '#034694'], ['Kingsway Rovers', '#6ce0ff'], ['Ironbridge City', '#f5c542'], ['Harbour Town', '#27d17f'], ['Oldfield Athletic', '#ff6b7d']] },
  { id: 'laliga', name: 'La Liga', sport: 'football', region: 'Spain', tier: 'Tier 1', accent: '#ffc247', teams: [['Real Marisma', '#ffffff'], ['Atletico Costa', '#e11d2e'], ['Sevilla Norte', '#27d17f'], ['Valencia Azul', '#2d8cff']] },
  { id: 'seriea', name: 'Serie A', sport: 'football', region: 'Italy', tier: 'Tier 1', accent: '#2d8cff', teams: [['Milano Rossoneri', '#e11d2e'], ['Torino Nerazzurri', '#0b2ea8'], ['Roma Collina', '#f5a524']] },
  { id: 'ucl', name: 'Champions Cup', sport: 'football', region: 'Europe', tier: 'Continental', accent: '#7b3cff', teams: [['Northside United', '#e11d2e'], ['Real Marisma', '#ffffff'], ['Munich Bavaria', '#dc052d'], ['Paris Lumiere', '#0d2d6b']] },
  { id: 'bundesliga', name: 'Bundesliga', sport: 'football', region: 'Germany', tier: 'Tier 1', accent: '#dc052d', teams: [['Munich Bavaria', '#dc052d'], ['Dortmund Nord', '#f5d800'], ['Leipzig Ost', '#e11d2e']] },
  { id: 'icc', name: 'ICC World Cup', sport: 'cricket', region: 'International', tier: 'World', accent: '#19c3ff', teams: [['India', '#2d8cff'], ['Australia', '#0b6b3a'], ['England', '#1a3b8f'], ['Pakistan', '#0f7b3a'], ['New Zealand', '#2b2b2b'], ['South Africa', '#0f6b46']] },
  { id: 'ipl', name: 'Premier T20 League', sport: 'cricket', region: 'India', tier: 'Franchise', accent: '#ffc247', teams: [['Mumbai Mariners', '#0b2ea8'], ['Chennai Lions', '#f5d800'], ['Bengaluru Blazers', '#e11d2e'], ['Kolkata Knights', '#3b0b6b']] },
  { id: 'ashes', name: 'The Ashes', sport: 'cricket', region: 'England / Australia', tier: 'Test', accent: '#27d17f', teams: [['England', '#1a3b8f'], ['Australia', '#0b6b3a']] },
  { id: 'bbl', name: 'Big Bash Twenty', sport: 'cricket', region: 'Australia', tier: 'Franchise', accent: '#ff6b7d', teams: [['Sydney Sixers', '#e11d2e'], ['Perth Scorchers', '#f5a524'], ['Melbourne Stars', '#0b6b3a']] },
  { id: 'nba', name: 'National Basketball', sport: 'basketball', region: 'USA', tier: 'Pro', accent: '#ff9f45', teams: [['Bay City Waves', '#2d8cff'], ['New York Towers', '#f5a524'], ['Chicago Foundry', '#e11d2e'], ['Denver Peaks', '#1a3b8f']] },
  { id: 'euroleague', name: 'EuroLeague', sport: 'basketball', region: 'Europe', tier: 'Continental', accent: '#19c3ff', teams: [['Madrid Baloncesto', '#ffffff'], ['Athens Olympia', '#0f7b3a'], ['Istanbul Bosphorus', '#e11d2e']] },
  { id: 'ncaa', name: 'College Championship', sport: 'basketball', region: 'USA', tier: 'College', accent: '#7b3cff', teams: [['Duke Valley', '#0b2ea8'], ['Kansas Prairie', '#e11d2e'], ['Gonzaga Ridge', '#1a3b8f']] },
  { id: 'atp', name: 'ATP Masters', sport: 'tennis', region: 'World', tier: 'Tour', accent: '#b66bff', teams: [['A. Kavara', '#c8ff2e'], ['M. Delacroix', '#2d8cff'], ['T. Okonkwo', '#ff9f45'], ['L. Ferrante', '#ff6b7d']] },
  { id: 'wta', name: 'WTA Tour', sport: 'tennis', region: 'World', tier: 'Tour', accent: '#ff6b7d', teams: [['S. Novakova', '#c8ff2e'], ['H. Ayala', '#19c3ff'], ['N. Bergstrom', '#b66bff']] },
  { id: 'grandslam', name: 'Grand Slam Series', sport: 'tennis', region: 'World', tier: 'Major', accent: '#f5c542', teams: [['Centre Court', '#27d17f'], ['No.1 Court', '#2d8cff'], ['Court Philippe', '#f5a524']] },
  { id: 'f1', name: 'World Formula Championship', sport: 'motorsport', region: 'World', tier: 'Tier 1', accent: '#e11d2e', teams: [['Aurora Racing', '#0b2ea8'], ['Scuderia Vespa', '#e11d2e'], ['Silver Arrow Motorsport', '#00c7b7'], ['Marina Bay Power', '#f5a524']] },
  { id: 'motogp', name: 'Grand Prix Motorcycle', sport: 'motorsport', region: 'World', tier: 'World', accent: '#ff3d5e', teams: [['Vale Corse', '#e11d2e'], ['Repsol Sierra', '#f5a524'], ['Pramac Nova', '#2d8cff']] },
  { id: 'fe', name: 'Electric Formula Series', sport: 'motorsport', region: 'World', tier: 'Electric', accent: '#19c3ff', teams: [['Volt Racing', '#19c3ff'], ['Nexus E-Team', '#7b3cff']] }
];

export const CATEGORY_DEFS: { id: string; label: string; sport: SportId; icon: string }[] = [
  { id: 'cat-football', label: 'Football', sport: 'football', icon: '⚽' },
  { id: 'cat-cricket', label: 'Cricket', sport: 'cricket', icon: '🏏' },
  { id: 'cat-basketball', label: 'Basketball', sport: 'basketball', icon: '🏀' },
  { id: 'cat-tennis', label: 'Tennis', sport: 'tennis', icon: '🎾' },
  { id: 'cat-motorsport', label: 'Motorsport', sport: 'motorsport', icon: '🏎️' },
  { id: 'cat-4k', label: 'All Sports 4K', sport: 'football', icon: '📺' },
  { id: 'cat-events', label: 'PPV Events', sport: 'basketball', icon: '🎟️' },
  { id: 'cat-rugby', label: 'Rugby', sport: 'football', icon: '🏉' },
  { id: 'cat-golf', label: 'Golf', sport: 'tennis', icon: '⛳' },
  { id: 'cat-combat', label: 'Combat Sports', sport: 'basketball', icon: '🥊' },
  { id: 'cat-athletics', label: 'Athletics', sport: 'motorsport', icon: '🏃' },
  { id: 'cat-esports', label: 'Esports', sport: 'basketball', icon: '🎮' }
];

const THUMBS: Record<SportId, string[]> = {
  football: [IMG.footballHero, IMG.footballStadium, IMG.footballNight, IMG.footballLights, IMG.footballPitch, IMG.stadiumPan, IMG.crowdBowl, IMG.stadiumTour],
  cricket: [IMG.cricketPacked, IMG.cricketNight, IMG.cricketGame, IMG.cricketAction, IMG.cricketField, IMG.cricketMono],
  basketball: [IMG.basketballArena, IMG.basketballAction, IMG.crowdBowl, IMG.stadiumPan],
  tennis: [IMG.tennisCourt, IMG.tennisStadium, IMG.stadiumTour, IMG.footballPitch],
  motorsport: [IMG.f1Track, IMG.f1Grid, IMG.f1Speed, IMG.f1Car, IMG.f1Opening]
};
const pick = <T,>(arr: T[], i: number): T => arr[((i % arr.length) + arr.length) % arr.length];
const hash = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return Math.abs(h); };
const VENUES: Record<SportId, string[]> = {
  football: ['Northside Park, Manchester', 'Estadio del Mar, Valencia', 'Stadio Collina, Rome', 'Riverside Arena, London'],
  cricket: ['Narendra Bowl, Ahmedabad', 'Melbourne Cricket Ground', 'Lord’s, London', 'Eden Gardens, Kolkata'],
  basketball: ['Bay Arena, San Francisco', 'Madison Tower, New York', 'Foundry Dome, Chicago', 'Peaks Center, Denver'],
  tennis: ['Centre Court, Wimbledon', 'Philippe Chatrier, Paris', 'Rod Laver Arena, Melbourne', 'Arthur Ashe Stadium, New York'],
  motorsport: ['Silverstone Circuit, UK', 'Marina Bay Street Circuit, Singapore', 'Monza, Italy', 'Spa-Francorchamps, Belgium']
};

function buildMatches(leagues: League[], now: number): Match[] {
  const out: Match[] = [];
  leagues.forEach((lg, li) => {
    const rounds = lg.sport === 'tennis' ? 4 : 3;
    for (let r = 0; r < rounds; r++) {
      const home = pick(lg.teams, r + li);
      const away = pick(lg.teams, r + li + 1 + (lg.teams.length > 2 ? 1 : 0));
      if (home.id === away.id) continue;
      /* offset hours: live / starting soon / later today / tomorrow */
      const offsetHours = [-0.6, -0.25, 1.2, 3.5, 26, 30, 50][(li + r) % 7];
      const kickoff = new Date(now + offsetHours * 3600000).toISOString();
      const id = `${lg.id}-${r}-${home.id}-${away.id}`;
      const h = hash(id);
      const liveish = offsetHours < 0;
      const isTennis = lg.sport === 'tennis';
      const isCricket = lg.sport === 'cricket';
      const status = liveish ? 'live' : offsetHours > 100 ? 'finished' : 'upcoming';
      out.push({
        id, sport: lg.sport, leagueId: lg.id, leagueName: lg.name, region: lg.region,
        home, away, status: status as Match['status'], kickoff,
        durationMin: isTennis ? 150 : isCricket ? 210 : lg.sport === 'motorsport' ? 120 : 110,
        minute: liveish ? 12 + (h % 60) : 0,
        period: isTennis ? `Set ${1 + (h % 3)}` : isCricket ? `Innings ${1 + (h % 2)}` : status === 'upcoming' ? 'Kick-off' : `${1 + (h % 2)}st Half`,
        homeScore: 0, awayScore: 0, subscores: '',
        venue: pick(VENUES[lg.sport], h), channel: `${lg.name} Live ${1 + (h % 4)}`,
        premium: h % 3 === 0, featured: h % 4 === 0,
        streamPath: DEMO_PATHS[h % DEMO_PATHS.length],
        thumb: pick(THUMBS[lg.sport], h), viewers: `${1 + (h % 9)}.${h % 9}K`
      });
    }
  });
  /* scores: deterministic per match so the demo is stable but alive */
  out.forEach((m) => {
    const h = hash(m.id);
    if (m.sport === 'football') { m.homeScore = h % 4; m.awayScore = (h >> 3) % 4; m.subscores = ''; }
    else if (m.sport === 'basketball') { m.homeScore = 78 + (h % 30); m.awayScore = 74 + ((h >> 4) % 28); m.subscores = `Q${1 + (h % 4)}`; }
    else if (m.sport === 'cricket') { m.homeScore = 120 + (h % 120); m.awayScore = 110 + ((h >> 5) % 130); m.subscores = `${(h % 6) + 1}/${(h % 8) + 2} ov`; }
    else if (m.sport === 'tennis') { m.homeScore = h % 3; m.awayScore = (h >> 2) % 3; m.subscores = `${6}-${h % 7 ? 4 : 6}`; }
    else { m.homeScore = 1 + (h % 5); m.awayScore = 1 + ((h >> 3) % 5); m.subscores = `Lap ${1 + (h % 57)}`; }
  });
  return out;
}

function buildStandings(leagues: League[]): Record<string, StandingRow[]> {
  const out: Record<string, StandingRow[]> = {};
  leagues.forEach((lg) => {
    const rows = lg.teams.map((t) => {
      const h = hash(lg.id + t.id);
      const played = 10 + (h % 18), won = 4 + (h % 12), drawn = h % 5, lost = Math.max(0, played - won - drawn);
      return { pos: 0, team: t.name, color: t.color, played, won, drawn, lost, pts: won * 3 + drawn, extra: `${((h % 40) + 10)}` };
    }).sort((a, b) => b.pts - a.pts).map((r, i) => ({ ...r, pos: i + 1 }));
    out[lg.id] = rows;
  });
  return out;
}

const HL_TITLES: [SportId, string, string][] = [
  ['football', 'Northside United 3-2 Riverside — every goal', 'epl'],
  ['football', 'Champions Cup: the 92nd-minute winner in 4K', 'ucl'],
  ['cricket', 'Last over thriller — 18 needed from 6', 'ipl'],
  ['cricket', 'Ashes Day 3: the spell that turned the Test', 'ashes'],
  ['basketball', 'Bay City Waves: 40-point fourth quarter', 'nba'],
  ['tennis', 'Five-set comeback on Centre Court', 'grandslam'],
  ['motorsport', 'Lights out and a lap-one triple overtake', 'f1'],
  ['football', 'La Liga top corner: the weekend’s best strikes', 'laliga']
];

function buildHighlights(now: number, leagues: League[]): Highlight[] {
  return HL_TITLES.map(([sport, title, leagueId], i) => ({
    id: `hl-${i}`, title, sport, league: leagues.find((l) => l.id === leagueId)?.name || 'PlayBeat Digital',
    duration: `${2 + (i % 9)}:${String(10 + i * 3).slice(0, 2)}`,
    views: `${12 + i * 7}.${i % 9}K`, published: new Date(now - (i + 1) * 5400000).toISOString(),
    thumb: pick(THUMBS[sport], i + 1), streamPath: DEMO_PATHS[i % DEMO_PATHS.length]
  }));
}

const NEWS_DEFS: [SportId, string, string][] = [
  ['football', 'Champions Cup draw sets up a heavyweight last eight', 'PlayBeat Digital Desk'],
  ['cricket', 'Selectors name 15-man squad for the winter tour', 'Wire Report'],
  ['basketball', 'Trade deadline day: three moves that shift the table', 'Courtside'],
  ['motorsport', 'Qualifying washed out — grid set by championship order', 'Pit Lane'],
  ['tennis', 'Seedings confirmed ahead of the clay-court swing', 'Baseline'],
  ['football', 'How a mid-block press changed the derby', 'Tactics Board'],
  ['cricket', 'The yorker is back: death-overs economy analysed', 'Numbers Game'],
  ['motorsport', 'Cost cap explained: what the new rules mean', 'Pit Lane']
];

function buildNews(now: number): NewsItem[] {
  return NEWS_DEFS.map(([sport, title, source], i) => ({
    id: `news-${i}`, title, sport, source, summary: 'Demonstration editorial copy bundled with the PlayBeat Digital demo catalogue — replace with your newsroom feed in production.',
    published: new Date(now - (i + 1) * 3600000 * 3).toISOString(), thumb: pick(THUMBS[sport], i + 2)
  }));
}

export function buildCatalog(now: number): Catalog {
  const leagues: League[] = LEAGUE_DEFS.map((d) => ({
    id: d.id, name: d.name, sport: d.sport, region: d.region, tier: d.tier, accent: d.accent,
    teams: d.teams.map(([n, c]) => T(n, c)), matches: 0
  }));
  const matches = buildMatches(leagues, now);
  leagues.forEach((l) => { l.matches = matches.filter((m) => m.leagueId === l.id).length; });
  const categories: Category[] = CATEGORY_DEFS.map((c) => ({
    ...c, count: matches.filter((m) => m.sport === c.sport).length + (c.id === 'cat-4k' ? 72 : c.id === 'cat-esports' ? 24 : 18)
  }));
  return {
    demo: DEMO, provider: PROVIDER, generatedAt: new Date(now).toISOString(),
    leagues, matches, standings: buildStandings(leagues),
    highlights: buildHighlights(now, leagues), news: buildNews(now), categories
  };
}



/* Only openly licensed test streams ship with the demo catalogue. */
export const DEMO_PATHS = [
  'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  'https://test-streams.mux.dev/bbbAES/playlists/sample_aes/index.m3u8',
  'https://test-streams.mux.dev/tos_ismc/main.m3u8',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4'
];
