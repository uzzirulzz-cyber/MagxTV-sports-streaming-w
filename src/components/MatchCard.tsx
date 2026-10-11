import { Link } from 'react-router-dom';
import type { Match } from '../lib/types';
import { clock, dayLabel, countdown } from '../lib/format';
import { Crest, StatusPill } from './common';

export default function MatchCard({ m, compact = false }: { m: Match; compact?: boolean }) {
  const watch = `/watch/${m.id}`;
  return (
    <article className="card">
      <Link to={watch} className="card-link" aria-label={`Watch ${m.home.name} versus ${m.away.name}`}>
        <div className="card-media">
          <img src={m.thumb} alt="" loading="lazy" />
          <span className="pill pill-on-media">
            {m.status === 'live' ? <StatusPill match={m} /> : <>{m.status === 'upcoming' ? countdown(m.kickoff) || 'Starting' : 'Replay ready'}</>}
          </span>
          {m.premium && <span className="pill pill-lime" style={{ position: 'absolute', top: 10, right: 10, zIndex: 2 }}>PREMIUM</span>}
        </div>
        <div className="card-body">
          <div className="card-meta">
            <span>{m.leagueName}</span><span>·</span><span>{m.region}</span>
          </div>
          <h3 style={{ display: 'grid', gap: 8 }}>
            <span className="row" style={{ gap: 9 }}>
              <Crest name={m.home.name} color={m.home.color} short={m.home.short} size="sm" />
              <span style={{ fontWeight: 600, fontSize: 15 }}>{m.home.name}</span>
              {m.status !== 'upcoming' && <b className="mono" style={{ marginLeft: 'auto' }}>{m.homeScore}</b>}
            </span>
            <span className="row" style={{ gap: 9 }}>
              <Crest name={m.away.name} color={m.away.color} short={m.away.short} size="sm" />
              <span style={{ fontWeight: 600, fontSize: 15 }}>{m.away.name}</span>
              {m.status !== 'upcoming' && <b className="mono" style={{ marginLeft: 'auto' }}>{m.awayScore}</b>}
            </span>
          </h3>
          {!compact && (
            <div className="card-meta">
              <span>{dayLabel(m.kickoff)} {clock(m.kickoff)}</span><span>·</span>
              <span>{m.channel}</span><span>·</span><span>{m.viewers} watching</span>
            </div>
          )}
        </div>
      </Link>
    </article>
  );
}
