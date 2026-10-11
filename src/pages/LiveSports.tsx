import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import MatchCard from '../components/MatchCard';
import { DemoBadge, Empty, ErrorState, SectionHead, Skeletons } from '../components/common';
import { LiveScoreRow } from '../components/rows';
import { SPORTS } from '../lib/catalog';
import { isLiveNow } from '../lib/format';
import type { SportId } from '../lib/types';

type Filter = 'all' | 'live' | 'upcoming' | 'premium';

export default function LiveSports() {
  const { catalog, loading, error, refresh, status } = useApp();
  const [sport, setSport] = useState<SportId | 'all'>('all');
  const [filter, setFilter] = useState<Filter>('live');
  const [sort, setSort] = useState<'time' | 'league'>('time');

  const rows = useMemo(() => {
    let list = catalog.matches.slice();
    if (sport !== 'all') list = list.filter((m) => m.sport === sport);
    if (filter === 'live') list = list.filter(isLiveNow);
    if (filter === 'upcoming') list = list.filter((m) => m.status === 'upcoming');
    if (filter === 'premium') list = list.filter((m) => m.premium);
    list.sort((a, b) => (sort === 'time'
      ? new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
      : a.leagueName.localeCompare(b.leagueName)));
    return list;
  }, [catalog.matches, sport, filter, sort]);

  const liveCount = catalog.matches.filter(isLiveNow).length;

  return (
    <div className="wrap wrap-wide sec">
      <SectionHead eyebrow="Live hub" title="Live Sports"
        sub={`${liveCount} matches in play and ${catalog.matches.filter((m) => m.status === 'upcoming').length} fixtures ahead. Filter by sport, status or premium tier.`}
        action={status.demo ? <DemoBadge provider={status.provider} /> : undefined} />

      <div className="panel pad" style={{ marginBottom: 22 }}>
        <div className="row-between" style={{ gap: 14 }}>
          <div className="chips-scroll" role="tablist" aria-label="Filter by sport">
            <button className={`chip${sport === 'all' ? ' on' : ''}`} onClick={() => setSport('all')}>All sports</button>
            {SPORTS.map((s) => (
              <button key={s.id} className={`chip${sport === s.id ? ' on' : ''}`} onClick={() => setSport(s.id)}>
                <span aria-hidden="true">{s.icon}</span>{s.label}
              </button>
            ))}
          </div>
          <div className="row" style={{ gap: 10 }}>
            <div className="tabs" role="tablist" aria-label="Filter by status">
              {(['live', 'upcoming', 'premium', 'all'] as Filter[]).map((f) => (
                <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
                  {f === 'all' ? 'Everything' : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
            <select className="input" style={{ minHeight: 40, width: 'auto' }} value={sort} onChange={(e) => setSort(e.target.value as 'time' | 'league')} aria-label="Sort matches">
              <option value="time">Sort: kick-off time</option>
              <option value="league">Sort: competition</option>
            </select>
          </div>
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={() => void refresh()} /> : loading ? <Skeletons n={8} /> : rows.length === 0 ? (
        <Empty title="No matches match those filters" body="Try switching the status filter back to Everything, or pick a different sport."
          action={<button className="btn btn-lime" onClick={() => { setSport('all'); setFilter('all'); }}>Reset filters</button>} />
      ) : (
        <>
          <div className="panel pad" style={{ marginBottom: 22 }}>
            <div className="row-between" style={{ marginBottom: 10 }}>
              <b>Scoreboard</b><span className="muted tiny">{rows.length} matches listed</span>
            </div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
              {rows.filter((m) => m.status !== 'upcoming').slice(0, 6).map((m) => <LiveScoreRow key={m.id} m={m} />)}
              {rows.filter((m) => m.status !== 'upcoming').length === 0 && <p className="muted" style={{ margin: 0 }}>No in-play matches for this filter — upcoming fixtures are below.</p>}
            </div>
          </div>
          <div className="grid-cards">{rows.map((m) => <MatchCard key={m.id} m={m} />)}</div>
        </>
      )}
    </div>
  );
}
