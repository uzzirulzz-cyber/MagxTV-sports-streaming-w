import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import MatchCard from '../components/MatchCard';
import { HighlightCard } from '../components/rows';
import { Empty, SectionHead } from '../components/common';
import { SPORTS } from '../lib/catalog';
import type { SportId } from '../lib/types';

export default function Search() {
  const [params, setParams] = useSearchParams();
  const { catalog } = useApp();
  const initial = params.get('q') ?? '';
  const [q, setQ] = useState(initial);
  const [sport, setSport] = useState<SportId | 'all'>('all');

  const term = (params.get('q') ?? initial).trim().toLowerCase();

  const results = useMemo(() => {
    const m = catalog.matches.filter((x) => sport === 'all' || x.sport === sport)
      .filter((x) => term === '' || [x.home.name, x.away.name, x.leagueName, x.region, x.venue, x.channel].join(' ').toLowerCase().includes(term));
    const h = catalog.highlights.filter((x) => sport === 'all' || x.sport === sport)
      .filter((x) => term === '' || [x.title, x.league].join(' ').toLowerCase().includes(term));
    const l = catalog.leagues.filter((x) => sport === 'all' || x.sport === sport)
      .filter((x) => term === '' || [x.name, x.region, x.tier].join(' ').toLowerCase().includes(term));
    return { m, h, l };
  }, [catalog, term, sport]);

  const run = (e: React.FormEvent) => { e.preventDefault(); setParams(q.trim() ? { q: q.trim() } : {}); };

  const suggestions = ['Premier League', 'Cricket', 'Formula', 'Champions Cup', 'Bay City'];

  return (
    <div className="wrap wrap-wide sec">
      <SectionHead eyebrow="Search" title={term ? `Results for “${params.get('q')}”` : 'Search the catalogue'}
        sub="Find teams, competitions, venues, channels and highlights across the whole catalogue." />

      <form className="panel pad row-between" style={{ marginBottom: 22 }} onSubmit={run}>
        <div className="searchbox" style={{ flex: 1, minWidth: 260, maxWidth: 560 }}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d="M10 2a8 8 0 1 0 4.9 14.3l5 5 1.4-1.4-5-5A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Team, competition, venue…" aria-label="Search term" />
        </div>
        <div className="row" style={{ gap: 10 }}>
          <select className="input" style={{ minHeight: 44, width: 'auto' }} value={sport} onChange={(e) => setSport(e.target.value as SportId | 'all')} aria-label="Sport filter">
            <option value="all">All sports</option>
            {SPORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <button className="btn btn-lime" type="submit">Search</button>
        </div>
      </form>

      <div className="chips-scroll" style={{ marginBottom: 22 }}>
        <span className="muted small" style={{ alignSelf: 'center' }}>Try:</span>
        {suggestions.map((s) => (
          <button key={s} className="chip" onClick={() => { setQ(s); setParams({ q: s }); }}>{s}</button>
        ))}
      </div>

      {term === '' ? (
        <Empty title="Start typing to search" body="Search across matches, competitions and highlights. Use a suggested term above to see it working." />
      ) : (
        <>
          <SectionHead title={`${results.m.length} match${results.m.length === 1 ? '' : 'es'}`} eyebrow="Matches" />
          {results.m.length ? <div className="grid-cards">{results.m.slice(0, 12).map((m) => <MatchCard key={m.id} m={m} />)}</div>
            : <p className="muted">No matches matched that term.</p>}

          {results.h.length > 0 && (
            <div className="sec">
              <SectionHead title={`${results.h.length} highlight${results.h.length === 1 ? '' : 's'}`} eyebrow="Highlights" />
              <div className="grid-cards">{results.h.map((h) => <HighlightCard key={h.id} h={h} />)}</div>
            </div>
          )}

          {results.l.length > 0 && (
            <div className="sec">
              <SectionHead title={`${results.l.length} competition${results.l.length === 1 ? '' : 's'}`} eyebrow="Competitions" />
              <div className="grid-cards">
                {results.l.map((l) => (
                  <div key={l.id} className="card">
                    <div className="card-body">
                      <h3>{l.name}</h3>
                      <div className="card-meta"><span>{l.region}</span><span>·</span><span>{l.tier}</span><span>·</span><span>{l.matches} matches</span></div>
                      <a className="btn btn-sm btn-lime" href={l.sport === 'motorsport' ? '/motorsports' : `/${l.sport}`}>Open hub</a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
