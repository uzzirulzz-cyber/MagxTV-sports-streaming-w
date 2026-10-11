export type SportId = 'football' | 'cricket' | 'basketball' | 'tennis' | 'motorsport';
export type MatchStatus = 'live' | 'upcoming' | 'finished';
export type Role = 'user' | 'admin';

export interface User {
  id: string; name: string; email: string; role: Role;
  plan: 'free' | 'standard' | 'premium'; createdAt: string;
}
export interface Team { id: string; name: string; short: string; color: string }
export interface Match {
  id: string; sport: SportId; leagueId: string; leagueName: string; region: string;
  home: Team; away: Team; status: MatchStatus;
  kickoff: string; durationMin: number; minute: number; period: string;
  homeScore: number; awayScore: number; subscores: string;
  venue: string; channel: string; premium: boolean; featured: boolean;
  streamPath: string | null; /* null = no authorised source configured */
  thumb: string; viewers: string;
}
export interface League {
  id: string; name: string; sport: SportId; region: string; tier: string;
  accent: string; teams: Team[]; matches: number;
}
export interface Highlight {
  id: string; title: string; sport: SportId; league: string; duration: string;
  views: string; published: string; thumb: string; streamPath: string;
}
export interface NewsItem {
  id: string; title: string; sport: SportId; source: string;
  published: string; thumb: string; summary: string;
}
export interface Category { id: string; label: string; sport: SportId; icon: string; count: number }
export interface StandingRow { pos: number; team: string; color: string; played: number; won: number; drawn: number; lost: number; pts: number; extra: string }
export interface Notification { id: string; title: string; body: string; at: string; read: boolean; kind: 'match' | 'goal' | 'system' }
export interface Catalog {
  demo: boolean; provider: string; generatedAt: string;
  leagues: League[]; matches: Match[]; highlights: Highlight[]; news: NewsItem[]; categories: Category[];
  standings: Record<string, StandingRow[]>;
}
export interface StreamSource { id: string; label: string; url: string; licensed: string }
