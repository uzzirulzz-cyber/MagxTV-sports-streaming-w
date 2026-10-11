import { Link } from 'react-router-dom';
import type { Highlight, Match, NewsItem, SportId, StandingRow } from '../lib/types';
import { clock, dayLabel, relTime } from '../lib/format';
import { Crest, StatusPill } from './common';

export function LiveScoreRow({ m }: { m: Match }) {
  const showScore = m.status !== 'upcoming';
  return (
    <Link to={`/watch/${m.id}`} className="score-row" style={{ display: 'flex' }} aria-label={`${m.home.name} vs ${m.away.name}`}>
      <div className="teams">
        <div className="team"><Crest name={m.home.name} color={m.home.color} short={m.home.short} size="sm" /><span>{m.home.name}</span></div>
        <div className="team"><Crest name={m.away.name} color={m.away.color} short={m.away.short} size="sm" /><span>{m.away.name}</span></div>
      </div>
      <div className="score mono">
        {showScore ? <>{m.homeScore}<br />{m.awayScore}</> : <span className="muted small">{clock(m.kickoff)}</span>}
        <small>{m.status === 'live' ? m.period : dayLabel(m.kickoff)}</small>
      </div>
      <div style={{ textAlign: 'right', minWidth: 62 }}>
        {m.status === 'live' ? <><StatusPill match={m} /><div className="minute" style={{ marginTop: 4 }}>{m.minute}’</div></> : <span className="pill">{m.leagueName.split(' ')[0]}</span>}
      </div>
    </Link>
  );
}

export function FixtureRow({ m }: { m: Match }) {
  return (
    <div className="fx-row">
      <div className="fx-when"><b>{dayLabel(m.kickoff)}</b>{clock(m.kickoff)}</div>
      <div>
        <div className="fx-teams">
          <Crest name={m.home.name} color={m.home.color} short={m.home.short} size="sm" />
          <span>{m.home.name}</span>
          <span className="fx-vs">vs</span>
          <Crest name={m.away.name} color={m.away.color} short={m.away.short} size="sm" />
          <span>{m.away.name}</span>
        </div>
        <div className="card-meta" style={{ marginTop: 6 }}><span>{m.leagueName}</span><span>·</span><span>{m.venue}</span></div>
      </div>
      <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
        {m.premium && <span className="pill pill-lime">PREMIUM</span>}
        <Link className="btn btn-sm btn-lime" to={`/watch/${m.id}`}>Watch</Link>
      </div>
    </div>
  );
}

export function HighlightCard({ h }: { h: Highlight }) {
  return (
    <article className="card">
      <Link to={`/watch/hl-${h.id}`} className="card-link">
        <div className="card-media">
          <img src={h.thumb} alt="" loading="lazy" />
          <span className="pill pill-on-media">▶ {h.duration}</span>
        </div>
        <div className="card-body">
          <h3 style={{ fontSize: 15.5 }}>{h.title}</h3>
          <div className="card-meta"><span>{h.league}</span><span>·</span><span>{h.views} views</span><span>·</span><span>{relTime(h.published)}</span></div>
        </div>
      </Link>
    </article>
  );
}

export function NewsList({ items }: { items: NewsItem[] }) {
  return (
    <div>
      {items.map((n) => (
        <article className="news-item" key={n.id}>
          <img className="news-thumb" src={n.thumb} alt="" loading="lazy" />
          <div>
            <h4>{n.title}</h4>
            <div className="card-meta"><span>{n.source}</span><span>·</span><span>{relTime(n.published)}</span></div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function SportTile({ id, label, icon, href, count }: { id: SportId; label: string; icon: string; href: string; count: number }) {
  void id;
  return (
    <Link className="sport-tile" to={href}>
      <span className="ico" aria-hidden="true">{icon}</span>
      <b>{label}</b>
      <small>{count} live & upcoming</small>
    </Link>
  );
}

export function StandingsTable({ rows, kind, title }: { rows: StandingRow[]; kind: string; title: string }) {
  const extraHead = kind === 'drivers' ? 'Pts' : kind === 'points' ? 'NRR' : kind === 'rankings' ? 'Titles' : 'GD';
  const showDraw = kind === 'standings' || kind === 'conference';
  return (
    <div className="table-wrap">
      <table>
        <caption className="sr-only" style={{ position: 'absolute', left: -9999 }}>{title}</caption>
        <thead>
          <tr>
            <th style={{ width: 46 }}>#</th><th>Team</th>
            <th className="num">P</th><th className="num">W</th>
            {showDraw && <th className="num">D</th>}
            <th className="num">L</th><th className="num">{extraHead}</th><th className="num">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team}>
              <td className="mono">{r.pos}</td>
              <td>
                <span className="row" style={{ gap: 9 }}>
                  <Crest name={r.team} color={r.color} short={r.team.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()} size="sm" />
                  <span>{r.team}</span>
                </span>
              </td>
              <td className="num mono">{r.played}</td>
              <td className="num mono">{r.won}</td>
              {showDraw && <td className="num mono">{r.drawn}</td>}
              <td className="num mono">{r.lost}</td>
              <td className="num mono">{r.extra}</td>
              <td className="num mono"><b>{r.pts}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
