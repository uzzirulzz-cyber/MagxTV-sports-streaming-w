import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Catalog, Notification, User } from '../lib/types';
import * as api from '../lib/api';

export interface Toast { id: string; text: string; tone: 'good' | 'bad' | 'info' }

interface AppValue {
  user: User | null; ready: boolean;
  signIn: (e: string, p: string) => Promise<User>;
  signUp: (n: string, e: string, p: string) => Promise<User>;
  signOut: () => void;
  catalog: Catalog; loading: boolean; error: string | null;
  status: api.ProviderStatus; refresh: () => Promise<void>;
  favorites: string[]; isFavorite: (id: string) => boolean; toggleFavorite: (id: string) => void;
  notifications: Notification[]; unread: number;
  markAllRead: () => void; markRead: (id: string) => void; notify: (n: Omit<Notification, 'id' | 'at' | 'read'>) => void;
  toasts: Toast[]; toast: (text: string, tone?: Toast['tone']) => void; dismiss: (id: string) => void;
}

const Ctx = createContext<AppValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [catalog, setCatalog] = useState<Catalog>(api.CATALOG_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<api.ProviderStatus>({ provider: 'mock', demo: true, baseUrl: '', message: 'Loading provider status…' });
  const [favorites, setFavorites] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = api.uid();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  const dismiss = useCallback((id: string) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { catalog: cat, status: st } = await api.fetchCatalog();
      setCatalog(cat); setStatus(st);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the sports catalogue');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    setUser(api.currentUser());
    setFavorites(api.loadFavorites());
    setNotifications(api.seedNotifications());
    setReady(true);
    void refresh();
  }, [refresh]);

  const signIn = useCallback(async (email: string, password: string) => {
    const u = await api.login(email, password); setUser(u); toast(`Signed in as ${u.name}`, 'good'); return u;
  }, [toast]);
  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const u = await api.register(name, email, password); setUser(u); toast('Account created — welcome to MagxTV', 'good'); return u;
  }, [toast]);
  const signOut = useCallback(() => { api.logout(); setUser(null); toast('Signed out'); }, [toast]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((f) => {
      const next = f.includes(id) ? f.filter((x) => x !== id) : [...f, id];
      api.saveFavorites(next);
      toast(f.includes(id) ? 'Removed from favourites' : 'Added to favourites', f.includes(id) ? 'info' : 'good');
      return next;
    });
  }, [toast]);
  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);

  const persistNotif = useCallback((n: Notification[]) => { setNotifications(n); api.saveNotifications(n); }, []);
  const markAllRead = useCallback(() => persistNotif(notifications.map((n) => ({ ...n, read: true }))), [notifications, persistNotif]);
  const markRead = useCallback((id: string) => persistNotif(notifications.map((n) => (n.id === id ? { ...n, read: true } : n))), [notifications, persistNotif]);
  const notify = useCallback((n: Omit<Notification, 'id' | 'at' | 'read'>) => {
    persistNotif([{ ...n, id: api.uid(), at: new Date().toISOString(), read: false }, ...notifications].slice(0, 40));
  }, [notifications, persistNotif]);

  const value = useMemo<AppValue>(() => ({
    user, ready, signIn, signUp, signOut, catalog, loading, error, status, refresh,
    favorites, isFavorite, toggleFavorite, notifications, unread: notifications.filter((n) => !n.read).length,
    markAllRead, markRead, notify, toasts, toast, dismiss
  }), [user, ready, signIn, signUp, signOut, catalog, loading, error, status, refresh, favorites, isFavorite, toggleFavorite, notifications, markAllRead, markRead, notify, toasts, toast, dismiss]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used inside AppProvider');
  return v;
}
