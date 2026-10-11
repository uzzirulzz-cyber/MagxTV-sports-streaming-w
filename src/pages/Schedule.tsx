import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { FixtureRow, LiveScoreRow } from '../components/rows';
import { DemoBadge, Empty, SectionHead, Skeletons } from '../components/common';
import { SPORTS } from '../lib/catalog';
import { dayLabel, isLiveNow } from '../lib/format';
import type { SportId } from '../lib/types';

export default function Schedule() {
  const { catalog, loading, status, favorites, toggleFavorite } = useApp();
  const [sport, setSport] = useState<SportId | 'all'>('all');
  const [onlyFav, setOnlyFav] = useState(false);
  const [view, setView] = useState<'day' | 'list'>('day');

  const rows = useMemo(() => {
    let l = catalog.matches.slice();
    if (sport !== 'all') l = l.filter((m) => m.sport === sport);
    if (onlyFav) l = l.filter((m) => favorites.includes(m.id));
    l.sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
    return l;
  }, [catalog.matches, sport, onlyFav, favorites]);

  const days = useMemo(() => {
    const map = new Map<string, typeof rows>();
    rows.forEach((m) => {
      const k = dayLabel(m.kickoff);
      map.set(k, [...(map.get(k) ?? []), m]);
    });
    return [...map.entries()];
  }, [rows]);

  const today = new Date().toDateString();
  const todays = rows.filter((m) => new Date(m.kickoff).toDateString() === today);

  return (
    <div className="wrap wrap-wide sec">
      <SectionHead eyebrow="Fixtures" title="Schedule"
        sub="Every kick-off in the catalogue, grouped by day. Favourite a match to pin it to the top of your own list."
        action={status.demo ? <DemoBadge provider={status.provider} /> : undefined} />

      <div className="panel pad" style={{ marginBottom: 22 }}>
        <div className="row-between">
          <div className="chips-scroll">
            <button className={`chip${sport === 'all' ? ' on' : ''}`} onClick={() => setSport('all')}>All sports</button>
            {SPORTS.map((s) => <button key={s.id} className={`chip${sport === s.id ? ' on' : ''}`} onClick={() => setSport(s.id)}>{s.icon} {s.label}</button>)}
          </div>
          <div className="row" style={{ gap: 12 }}>
            <label className="row small" style={{ gap: 7 }}>
              <input type="checkbox" checked={onlyFav} onChange={(e) => setOnlyFav(e.target.checked)} /> Only favourites
            </label>
            <div className="tabs">
              <button className={view === 'day' ? 'on' : ''} onClick={() => setView('day')}>By day</button>
              <button className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>Flat list</button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', marginBottom: 22 }}>
        <div className="kpi"><b>{todays.length}</b><small>Matches today</small></div>
        <div className="kpi"><b>{todays.filter(isLiveNow).length}</b><small>In play right now</small></div>
        <div className="kpi"><b>{favorites.length}</b><small>Your favourites</small></div>
        <div className="kpi"><b>{catalog.leagues.length}</b><small>Competitions</small></div>
      </div>

      {loading ? <Skeletons n={6} cards={false} /> : rows.length === 0 ? (
        <Empty title={onlyFav ? 'No favourites to schedule' : 'Nothing scheduled'} body={onlyFav ? 'Add matches to your favourites and they will appear here.' : 'Try another sport filter.'} />
      ) : view === 'list' ? (
        <div className="panel pad">{rows.map((m) => (
          <div key={m.id} className="row-between" style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
            <FixtureRow m={m} />
            <button className="btn btn-sm btn-ghost" onClick={() => toggleFavorite(m.id)} aria-label="Toggle favourite">
              {favorites.includes(m.id) ? '♥' : '♡'}
            </button>
          </div>))}
        </div>
      ) : days.map(([day, list]) => (
        <div key={day} className="panel pad" style={{ marginBottom: 16 }}>
          <div className="row-between" style={{ marginBottom: 6 }}>
            <h3>{day}</h3>
            <span className="muted tiny">{list.length} match{list.length > 1 ? 'es' : ''}{list.some(isLiveNow) ? ' · live now' : ''}</span>
          </div>
          {list.filter(isLiveNow).slice(0, 2).map((m) => <LiveScoreRow key={m.id} m={m} />)}
          {list.filter((m) => !isLiveNow(m)).map((m) => <FixtureRow key={m.id} m={m} />)}
        </div>
      ))}
    </div>
  );
}
