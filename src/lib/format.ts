export const pad = (n: number) => String(n).padStart(2, '0');

export function clock(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function dayLabel(iso: string): string {
  const d = new Date(iso), now = new Date();
  const diff = Math.round((new Date(d.toDateString()).getTime() - new Date(now.toDateString()).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
export function relTime(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
export function countdown(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return '';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${pad(m)}m` : `${m}m ${pad(s % 60)}s`;
}
export function elapsed(fromIso: string, to = Date.now()): number {
  return Math.max(0, Math.floor((to - new Date(fromIso).getTime()) / 60000));
}
export function isLiveNow(m: { kickoff: string; durationMin: number; status: string }): boolean {
  if (m.status === 'finished') return false;
  const start = new Date(m.kickoff).getTime(), end = start + m.durationMin * 60000;
  return Date.now() >= start && Date.now() < end;
}
export function statusOf(m: { kickoff: string; durationMin: number; status: string }): 'live' | 'upcoming' | 'finished' {
  const start = new Date(m.kickoff).getTime(), end = start + m.durationMin * 60000, now = Date.now();
  if (now >= start && now < end) return 'live';
  return now < start ? 'upcoming' : 'finished';
}
export function initials(name: string): string {
  const w = name.replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  if (!w.length) return 'TV';
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[w.length - 1][0]).toUpperCase();
}
export function pct(n: number, of: number): number { return of <= 0 ? 0 : Math.round((n / of) * 100); }
