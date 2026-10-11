import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { Match, SportId } from '../lib/types';

export function SectionHead({ eyebrow, title, sub, action }: { eyebrow?: string; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="sec-head">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skeletons({ n = 6, cards = true }: { n?: number; cards?: boolean }) {
  return (
    <div className={cards ? 'grid-cards' : 'stack'} aria-hidden="true">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className={cards ? 'card' : 'panel pad'} style={cards ? undefined : { padding: 16 }}>
          {cards && <div className="skel" style={{ aspectRatio: '16/9', borderRadius: 0 }} />}
          <div className="card-body">
            <div className="skel" style={{ height: 15, width: '72%' }} />
            <div className="skel" style={{ height: 12, width: '46%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="panel state">
      <div style={{ fontSize: 34 }}>🔍</div>
      <h3>{title}</h3>
      <p className="muted" style={{ maxWidth: '48ch' }}>{body}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="panel state">
      <div style={{ fontSize: 34 }}>⚠️</div>
      <h3>Something interrupted the feed</h3>
      <p className="muted" style={{ maxWidth: '56ch' }}>{message}</p>
      <button className="btn btn-lime" onClick={onRetry}>Try again</button>
    </div>
  );
}

export function DemoBadge({ provider }: { provider: string }) {
  return <span className="demo-badge" title={`Provider: ${provider}`}>● DEMO DATA — {provider.toUpperCase()} PROVIDER</span>;
}

export function Crest({ name, color, short, size = '' }: { name: string; color: string; short: string; size?: 'lg' | 'sm' | '' }) {
  const cls = `crest${size ? ' ' + size : ''}`;
  return <span className={cls} style={{ background: color, color: pickInk(color) }} aria-hidden="true" title={name}>{short}</span>;
}

function pickInk(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return '#fff';
  const [r, g, b] = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  return 0.299 * r + 0.587 * g + 0.114 * b > 165 ? '#06122e' : '#ffffff';
}

export function StatusPill({ match }: { match: Pick<Match, 'status'> & { period?: string; minute?: number } }) {
  if (match.status === 'live') return <span className="pill pill-live"><span className="live-dot" style={{ background: '#fff' }} /> LIVE</span>;
  if (match.status === 'finished') return <span className="pill">FULL TIME</span>;
  return <span className="pill pill-cyan">UPCOMING</span>;
}

export function sportHref(sport: SportId): string {
  return sport === 'motorsport' ? '/motorsports' : `/${sport}`;
}

export function MatchLink({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  return <Link to={to} className={className}>{children}</Link>;
}
