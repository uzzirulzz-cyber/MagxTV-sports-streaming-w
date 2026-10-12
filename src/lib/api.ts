import type { Catalog, Notification, Role, User } from './types';
import { CATALOG, buildCatalog } from './catalog';

const RAW = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';
export const API_BASE = RAW.replace(/\/+$/, '');
export const API_CONFIGURED = API_BASE.length > 0;

const K = { users: 'pbd.users', session: 'pbd.session', fav: 'pbd.favorites', notif: 'pbd.notifications', overrides: 'pbd.admin.matchOverrides' };

interface StoredUser extends User { secret: string }
interface Session { token: string; userId: string; at: string }

const read = <T,>(k: string, fb: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fb; } catch { return fb; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage disabled */ } };
/* Demo-only credential store. Real deployments use the API (bcrypt + JWT). */
const scramble = (s: string) => btoa(unescape(encodeURIComponent('pbd::' + s)));
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function ensureSeed() {
  const users = read<StoredUser[]>(K.users, []);
  if (users.length) return users;
  const seeded: StoredUser[] = [
    { id: uid(), name: 'PlayBeat Digital Admin', email: 'admin@playbeat.digital', role: 'admin', plan: 'premium', createdAt: new Date().toISOString(), secret: scramble('PlayBeatAdmin#2026') },
    { id: uid(), name: 'Sam Supporter', email: 'demo@playbeat.digital', role: 'user', plan: 'standard', createdAt: new Date().toISOString(), secret: scramble('PlayBeatDemo#2026') }
  ];
  write(K.users, seeded);
  return seeded;
}
const publicUser = ({ secret, ...u }: StoredUser): User => { void secret; return u; };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = read<Session | null>(K.session, null)?.token;
  const res = await fetch(API_BASE + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers || {}) }
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || 'Request failed');
  return (await res.json()) as T;
}

/* ---------- catalogue ---------- */
export interface ProviderStatus { provider: string; demo: boolean; baseUrl: string; message: string }

export async function fetchCatalog(): Promise<{ catalog: Catalog; status: ProviderStatus }> {
  if (API_CONFIGURED) {
    try {
      const data = await request<{ catalog: Catalog; status: ProviderStatus }>('/api/catalog');
      return data;
    } catch { /* fall through to bundled demo catalogue */ }
  }
  const cat = buildCatalog(Date.now());
  return {
    catalog: cat,
    status: { provider: 'mock', demo: true, baseUrl: '', message: 'No sports data API is connected — showing the bundled, clearly labelled demo catalogue (demo:true).' }
  };
}

/* ---------- auth ---------- */
export async function login(email: string, password: string): Promise<User> {
  if (API_CONFIGURED) {
    try {
      const r = await request<{ token: string; user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      write(K.session, { token: r.token, userId: r.user.id, at: new Date().toISOString() });
      return r.user;
    } catch (e) {
      if (e instanceof Error && /invalid|credentials|password/i.test(e.message)) throw e;
    }
  }
  const users = ensureSeed();
  const u = users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
  if (!u || u.secret !== scramble(password)) throw new Error('Email or password is incorrect');
  write(K.session, { token: 'demo.' + u.id, userId: u.id, at: new Date().toISOString() });
  return publicUser(u);
}

export async function register(name: string, email: string, password: string): Promise<User> {
  if (API_CONFIGURED) {
    try {
      const r = await request<{ token: string; user: User }>('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) });
      write(K.session, { token: r.token, userId: r.user.id, at: new Date().toISOString() });
      return r.user;
    } catch (e) {
      if (e instanceof Error && /exists|taken|short|invalid/i.test(e.message)) throw e;
    }
  }
  const users = ensureSeed();
  if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) throw new Error('An account with that email already exists');
  if (password.length < 8) throw new Error('Password must be at least 8 characters');
  const nu: StoredUser = { id: uid(), name: name.trim() || 'New Viewer', email: email.trim(), role: 'user', plan: 'free', createdAt: new Date().toISOString(), secret: scramble(password) };
  write(K.users, [...users, nu]);
  write(K.session, { token: 'demo.' + nu.id, userId: nu.id, at: new Date().toISOString() });
  return publicUser(nu);
}

export function currentUser(): User | null {
  const s = read<Session | null>(K.session, null);
  if (!s) return null;
  const u = ensureSeed().find((x) => x.id === s.userId);
  return u ? publicUser(u) : null;
}
export function logout() { write(K.session, null); }

/* ---------- favourites ---------- */
export function loadFavorites(): string[] {
  const local = read<string[]>(K.fav, []);
  return local;
}
export function saveFavorites(ids: string[]) { write(K.fav, ids); }

/* ---------- notifications ---------- */
export function seedNotifications(): Notification[] {
  const existing = read<Notification[]>(K.notif, []);
  if (existing.length) return existing;
  const now = Date.now();
  const seeded: Notification[] = [
    { id: uid(), kind: 'goal', title: 'Goal — Northside United', body: 'Northside United 2-1 Riverside FC (63’)', at: new Date(now - 9 * 60000).toISOString(), read: false },
    { id: uid(), kind: 'match', title: 'Kick-off in 15 minutes', body: 'Champions Cup: Real Marisma vs Munich Bavaria', at: new Date(now - 42 * 60000).toISOString(), read: false },
    { id: uid(), kind: 'system', title: 'Welcome to PlayBeat Digital', body: 'Favourite a competition to get kick-off reminders.', at: new Date(now - 5 * 3600000).toISOString(), read: true }
  ];
  write(K.notif, seeded);
  return seeded;
}
export function saveNotifications(n: Notification[]) { write(K.notif, n); }

/* ---------- admin ---------- */
export interface AdminUser { id: string; name: string; email: string; role: Role; plan: string; createdAt: string }
export async function adminUsers(): Promise<AdminUser[]> {
  if (API_CONFIGURED) {
    try { return await request<AdminUser[]>('/api/admin/users'); } catch { /* local */ }
  }
  return ensureSeed().map(({ id, name, email, role, plan, createdAt }) => ({ id, name, email, role, plan, createdAt }));
}
export async function adminUpdateUser(id: string, patch: Partial<Pick<AdminUser, 'role' | 'plan'>>): Promise<AdminUser[]> {
  if (API_CONFIGURED) {
    try { return await request<AdminUser[]>(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }); } catch { /* local */ }
  }
  const users = ensureSeed().map((u) => (u.id === id ? { ...u, ...patch } : u));
  write(K.users, users);
  return users.map(({ secret, ...u }) => { void secret; return u; });
}
export const streamOverrides = () => read<Record<string, boolean>>(K.overrides, {});
export function setStreamOverride(id: string, enabled: boolean) { write(K.overrides, { ...streamOverrides(), [id]: enabled }); }
export const CATALOG_FALLBACK = CATALOG;
