import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import MatchCard from '../components/MatchCard';
import { Empty, SectionHead } from '../components/common';
import { dayLabel, relTime, isLiveNow } from '../lib/format';
import * as api from '../lib/api';
import type { AdminUser } from '../lib/api';

export default function Profile() {
  const { user, catalog, favorites, notifications, markAllRead, signOut, toast, isFavorite } = useApp();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const favMatches = catalog.matches.filter((m) => favorites.includes(m.id));

  useEffect(() => { void api.adminUsers().then(setUsers).catch(() => setUsers([])); }, [user]);

  if (!user) {
    return (
      <div className="wrap sec">
        <Empty title="You are signed out" body="Sign in to manage favourites, reminders and playback devices."
          action={<Link className="btn btn-lime" to="/login">Sign in</Link>} />
      </div>
    );
  }

  const initials = user.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="wrap wrap-wide sec">
      <div className="panel pad" style={{ marginBottom: 22 }}>
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div className="row" style={{ gap: 16 }}>
            <span className="avatar" style={{ width: 64, height: 64, fontSize: 22 }}>{initials}</span>
            <div>
              <h1 style={{ fontSize: 26 }}>{user.name}</h1>
              <div className="muted small">{user.email}</div>
              <div className="row" style={{ gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                <span className="pill pill-lime">{user.plan.toUpperCase()} PLAN</span>
                <span className="pill">{user.role === 'admin' ? 'ADMINISTRATOR' : 'VIEWER'}</span>
                <span className="pill">Member since {dayLabel(user.createdAt)}</span>
              </div>
            </div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            {user.role === 'admin' && <Link className="btn btn-lime" to="/admin">Open admin dashboard</Link>}
            <button className="btn" onClick={() => { signOut(); }}>Sign out</button>
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', marginBottom: 24 }}>
        <div className="kpi"><b>{favMatches.length}</b><small>Favourite matches</small></div>
        <div className="kpi"><b>{favMatches.filter(isLiveNow).length}</b><small>Favourites live now</small></div>
        <div className="kpi"><b>{notifications.filter((n) => !n.read).length}</b><small>Unread notifications</small></div>
        <div className="kpi"><b>{catalog.leagues.length}</b><small>Competitions available</small></div>
      </div>

      <div className="side-layout">
        <div>
          <SectionHead eyebrow="Your list" title="Favourite matches"
            action={<Link className="btn btn-ghost" to="/schedule">Find more matches</Link>} />
          {favMatches.length ? <div className="grid-cards">{favMatches.map((m) => <MatchCard key={m.id} m={m} />)}</div>
            : <Empty title="No favourites yet" body="Tap the heart on any match card, or in the player control bar, to save it here."
              action={<Link className="btn btn-lime" to="/live">Browse live sports</Link>} />}
        </div>

        <aside>
          <div className="panel pad" style={{ marginBottom: 18 }}>
            <div className="row-between" style={{ marginBottom: 10 }}>
              <b>Notifications</b>
              <button className="btn btn-sm btn-ghost" onClick={markAllRead} disabled={!notifications.some((n) => !n.read)}>Mark all read</button>
            </div>
            <div className="stack">
              {notifications.map((n) => (
                <div key={n.id} className="panel" style={{ padding: '10px 12px', background: 'rgba(255,255,255,.05)', opacity: n.read ? .7 : 1 }}>
                  <b className="small">{n.kind === 'goal' ? '⚽ ' : n.kind === 'match' ? '📅 ' : 'ℹ️ '}{n.title}</b>
                  <div className="muted tiny">{n.body}</div>
                  <div className="muted tiny">{relTime(n.at)}</div>
                </div>
              ))}
              {notifications.length === 0 && <p className="muted tiny" style={{ margin: 0 }}>No notifications yet.</p>}
            </div>
          </div>

          <div className="panel pad" style={{ marginBottom: 18 }}>
            <b>Playback preferences</b>
            <div className="stack" style={{ gap: 12, marginTop: 10 }}>
              <label className="row small" style={{ gap: 8 }}><input type="checkbox" defaultChecked /> Start streams muted</label>
              <label className="row small" style={{ gap: 8 }}><input type="checkbox" defaultChecked /> Autoplay next highlight</label>
              <label className="row small" style={{ gap: 8 }}><input type="checkbox" /> Data saver (cap at 720p)</label>
            </div>
            <p className="muted tiny" style={{ marginTop: 10 }}>Preference toggles are UI-local in this demo build; store them against the user row to persist them server-side.</p>
          </div>

          <div className="panel pad">
            <b>Registered accounts</b>
            <p className="muted tiny" style={{ marginTop: 6 }}>{users.length} account{users.length === 1 ? '' : 's'} in this environment.</p>
            <div className="table-wrap" style={{ maxHeight: 220, overflowY: 'auto' }}>
              <table><thead><tr><th>Name</th><th>Role</th><th>Plan</th></tr></thead>
                <tbody>{users.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.role}</td><td>{u.plan}</td></tr>)}</tbody></table>
            </div>
            <button className="btn btn-sm btn-ghost btn-block" style={{ marginTop: 10 }} onClick={() => toast('Profile changes are saved locally in this demo build')}>Save profile changes</button>
          </div>
        </aside>
      </div>
    </div>
  );
}
