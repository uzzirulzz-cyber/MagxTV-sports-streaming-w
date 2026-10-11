import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { HighlightCard } from '../components/rows';
import { DemoBadge, Empty, SectionHead, Skeletons } from '../components/common';
import { SPORTS } from '../lib/catalog';
import type { SportId } from '../lib/types';

export default function Highlights() {
  const { catalog, loading, status } = useApp();
  const [sport, setSport] = useState<SportId | 'all'>('all');
  const [q, setQ] = useState('');

  const list = useMemo(() => catalog.highlights.filter((h) =>
    (sport === 'all' || h.sport === sport) && (q.trim() === '' || (h.title + h.league).toLowerCase().includes(q.trim().toLowerCase()))
  ), [catalog.highlights, sport, q]);

  return (
    <div className="wrap wrap-wide sec">
      <SectionHead eyebrow="Watch again" title="Highlights &amp; replays"
        sub="Condensed match packages and standout moments, ready to play in the same player as the live feeds."
        action={status.demo ? <DemoBadge provider={status.provider} /> : undefined} />

      <div className="panel pad" style={{ marginBottom: 22 }}>
        <div className="row-between">
          <div className="chips-scroll">
            <button className={`chip${sport === 'all' ? ' on' : ''}`} onClick={() => setSport('all')}>All sports</button>
            {SPORTS.map((s) => <button key={s.id} className={`chip${sport === s.id ? ' on' : ''}`} onClick={() => setSport(s.id)}>{s.icon} {s.label}</button>)}
          </div>
          <div className="searchbox" style={{ minWidth: 240 }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search highlights" aria-label="Search highlights" />
          </div>
        </div>
      </div>

      {loading ? <Skeletons n={8} /> : list.length ? <div className="grid-cards">{list.map((h) => <HighlightCard key={h.id} h={h} />)}</div>
        : <Empty title="No highlights found" body="Try a different sport or clear the search box." />}
    </div>
  );
}
