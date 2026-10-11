/* In-memory fallback store — used when DATABASE_URL is not configured. */
import bcrypt from 'bcryptjs';

export interface MemUser {
  id: string; name: string; email: string; password_hash: string;
  role: 'user' | 'admin'; plan: 'free' | 'standard' | 'premium'; created_at: string;
}
export interface MemFav { user_id: string; match_id: string }
export interface MemNote { id: string; user_id: string; kind: string; title: string; body: string; is_read: boolean; created_at: string }

export const memory = {
  users: [] as MemUser[],
  favorites: [] as MemFav[],
  notifications: [] as MemNote[],
  seeded: false
};

/* Seeded accounts — the same credentials are documented in the README and
   surfaced on the sign-in page as one-click demo logins. */
export const SEED_ADMIN = { name: 'MagxTV Admin', email: 'admin@magxtv.example', password: 'MagxAdmin#2026' };
export const SEED_USER = { name: 'Demo Viewer', email: 'demo@magxtv.example', password: 'MagxDemo#2026' };

export async function seedMemory(): Promise<void> {
  if (memory.seeded) return;
  memory.seeded = true;
  const hash = async (p: string) => bcrypt.hash(p, 10);
  const admin: MemUser = {
    id: 'u_admin', name: SEED_ADMIN.name, email: SEED_ADMIN.email, password_hash: await hash(SEED_ADMIN.password),
    role: 'admin', plan: 'premium', created_at: new Date(Date.now() - 864e5 * 40).toISOString()
  };
  const user: MemUser = {
    id: 'u_demo', name: SEED_USER.name, email: SEED_USER.email, password_hash: await hash(SEED_USER.password),
    role: 'user', plan: 'standard', created_at: new Date(Date.now() - 864e5 * 12).toISOString()
  };
  memory.users.push(admin, user);
  memory.notifications.push(
    { id: 'n_1', user_id: 'u_demo', kind: 'goal', title: 'Northside United 2-1 Riverside FC (63\')', body: 'Goal — Northside United take the lead in the second half.', is_read: false, created_at: new Date(Date.now() - 6e5).toISOString() },
    { id: 'n_2', user_id: 'u_demo', kind: 'match', title: 'Your favourite side kicks off in 30 minutes', body: 'Riverside FC vs Harbour City — coverage starts 15 minutes before kick-off.', is_read: false, created_at: new Date(Date.now() - 36e5).toISOString() },
    { id: 'n_3', user_id: 'u_demo', kind: 'system', title: 'Demo catalogue active', body: 'No sports data provider is configured, so clearly-labelled demo fixtures are being served.', is_read: true, created_at: new Date(Date.now() - 72e5).toISOString() }
  );
}
