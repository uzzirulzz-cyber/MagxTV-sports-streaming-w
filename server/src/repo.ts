/* Single data-access layer. Every method prefers PostgreSQL and transparently
   falls back to the in-memory store when DATABASE_URL is not configured, so the
   app is fully functional in both modes. */
import bcrypt from 'bcryptjs';
import { query, dbEnabled } from './db';
import { memory, seedMemory } from './store';
import type { ApiUser, Plan, Role } from './types';

export interface UserRow {
  id: string; name: string; email: string; password_hash: string;
  role: Role; plan: Plan; created_at: string | Date;
}
export interface FavoriteRow { match_id: string }
export interface NotificationRow {
  id: string | number; kind: string; title: string; body: string; is_read: boolean; created_at: string | Date;
}

export const toApiUser = (u: UserRow): ApiUser => ({
  id: u.id, name: u.name, email: u.email, role: u.role, plan: u.plan,
  createdAt: new Date(u.created_at).toISOString()
});

export const usingDatabase = () => dbEnabled;
export const isEphemeral = () => !dbEnabled;

export async function initStore(): Promise<void> {
  if (!dbEnabled) await seedMemory();
}

/* ------------------------------- users ------------------------------- */
export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const mail = email.trim().toLowerCase();
  if (dbEnabled) {
    const { rows } = await query<UserRow>('SELECT * FROM users WHERE lower(email) = $1', [mail]);
    return rows[0] ?? null;
  }
  const u = memory.users.find((x) => x.email.toLowerCase() === mail);
  return u ? (u as unknown as UserRow) : null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  if (dbEnabled) {
    const { rows } = await query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] ?? null;
  }
  const u = memory.users.find((x) => x.id === id);
  return u ? (u as unknown as UserRow) : null;
}

export async function createUser(name: string, email: string, password: string, role: Role = 'user', plan: Plan = 'free'): Promise<UserRow> {
  const hash = await bcrypt.hash(password, 10);
  const mail = email.trim().toLowerCase();
  if (dbEnabled) {
    const { rows } = await query<UserRow>(
      'INSERT INTO users (name, email, password_hash, role, plan) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name.trim(), mail, hash, role, plan]
    );
    return rows[0];
  }
  const row: UserRow = {
    id: 'u_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4),
    name: name.trim(), email: mail, password_hash: hash, role, plan, created_at: new Date().toISOString()
  };
  memory.users.push(row as never);
  return row;
}

export async function verifyPassword(user: UserRow, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.password_hash);
}

export async function listUsers(): Promise<ApiUser[]> {
  if (dbEnabled) {
    const { rows } = await query<UserRow>('SELECT * FROM users ORDER BY created_at ASC');
    return rows.map(toApiUser);
  }
  return memory.users.map((u) => toApiUser(u as unknown as UserRow));
}

export async function updateUserRole(id: string, role: Role, plan?: Plan): Promise<ApiUser | null> {
  if (dbEnabled) {
    const { rows } = await query<UserRow>(
      'UPDATE users SET role = $2, plan = COALESCE($3, plan) WHERE id = $1 RETURNING *', [id, role, plan ?? null]
    );
    return rows[0] ? toApiUser(rows[0]) : null;
  }
  const u = memory.users.find((x) => x.id === id);
  if (!u) return null;
  u.role = role;
  if (plan) u.plan = plan;
  return toApiUser(u as unknown as UserRow);
}

/* ----------------------------- favourites ---------------------------- */
export async function listFavorites(userId: string): Promise<string[]> {
  if (dbEnabled) {
    const { rows } = await query<FavoriteRow>('SELECT match_id FROM favorites WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    return rows.map((r) => r.match_id);
  }
  return memory.favorites.filter((f) => f.user_id === userId).map((f) => f.match_id);
}

export async function addFavorite(userId: string, matchId: string): Promise<string[]> {
  if (dbEnabled) {
    await query('INSERT INTO favorites (user_id, match_id) VALUES ($1,$2) ON CONFLICT (user_id, match_id) DO NOTHING', [userId, matchId]);
  } else if (!memory.favorites.some((f) => f.user_id === userId && f.match_id === matchId)) {
    memory.favorites.push({ user_id: userId, match_id: matchId });
  }
  return listFavorites(userId);
}

export async function removeFavorite(userId: string, matchId: string): Promise<string[]> {
  if (dbEnabled) await query('DELETE FROM favorites WHERE user_id = $1 AND match_id = $2', [userId, matchId]);
  else memory.favorites = memory.favorites.filter((f) => !(f.user_id === userId && f.match_id === matchId));
  return listFavorites(userId);
}

/* --------------------------- notifications --------------------------- */
export async function listNotifications(userId: string): Promise<NotificationRow[]> {
  if (dbEnabled) {
    const { rows } = await query<NotificationRow>(
      'SELECT id, kind, title, body, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [userId]);
    return rows;
  }
  return memory.notifications.filter((n) => n.user_id === userId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export async function addNotification(userId: string, kind: string, title: string, body: string): Promise<void> {
  if (dbEnabled) await query('INSERT INTO notifications (user_id, kind, title, body) VALUES ($1,$2,$3,$4)', [userId, kind, title, body]);
  else memory.notifications.unshift({
    id: 'n_' + Math.random().toString(36).slice(2, 9), user_id: userId, kind, title, body,
    is_read: false, created_at: new Date().toISOString()
  });
}

export async function markNotificationsRead(userId: string, id?: string | number): Promise<void> {
  if (dbEnabled) {
    if (id === undefined) await query('UPDATE notifications SET is_read = true WHERE user_id = $1', [userId]);
    else await query('UPDATE notifications SET is_read = true WHERE user_id = $1 AND id = $2', [userId, id]);
    return;
  }
  memory.notifications.forEach((n) => { if (n.user_id === userId && (id === undefined || n.id === id)) n.is_read = true; });
}
