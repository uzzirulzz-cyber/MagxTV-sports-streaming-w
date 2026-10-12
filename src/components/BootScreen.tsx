/* PlayBeat Digital boot experience — the premium startup sequence, shown once per session.
   Every stage is driven by a REAL readiness signal rather than a fixed timer:
     webfonts → provider status → sports catalogue → session & watchlist.
   Query flags (design review / capture only):
     ?boot=1     hold the intro open until the viewer continues
     ?boot=0     skip the intro entirely for this load
     ?stage=0-4  freeze the intro at that stage (deterministic screenshots) */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { BRAND } from '../lib/brand';
import '../styles/boot.css';

const STAGES = [
  { key: 'core', label: 'Starting PlayBeat Digital', detail: 'Loading the interface and webfonts' },
  { key: 'provider', label: 'Checking the stream provider', detail: 'Reaching the configured sports data source' },
  { key: 'catalog', label: 'Loading the sports catalogue', detail: 'Fixtures, live scores and highlights' },
  { key: 'you', label: 'Restoring your session', detail: 'Account, favourites and notifications' },
  { key: 'ready', label: 'Ready', detail: 'Handing over to the pitch' }
] as const;

const STAGE_COUNT = STAGES.length;
const MIN_SHOW_MS = 1100;   /* never flash the intro away */
const SETTLE_MS = 650;      /* beat between 100% and the fade-out */
const HARD_CAP_MS = 9000;   /* never hold a viewer hostage to a hung request */
const FADE_MS = 620;
const PLAYED_KEY = 'pbd.boot.played';

type StageState = 'pending' | 'active' | 'done';
interface Flags { skip: boolean; hold: boolean; frozen: number | null }

function readFlags(): Flags {
  if (typeof window === 'undefined') return { skip: false, hold: false, frozen: null };
  let params: URLSearchParams;
  try { params = new URLSearchParams(window.location.search); } catch { return { skip: false, hold: false, frozen: null }; }
  const boot = params.get('boot');
  const raw = params.get('stage');
  const frozen = raw !== null && /^\d+$/.test(raw) && Number(raw) < STAGE_COUNT ? Number(raw) : null;
  return { skip: boot === '0', hold: boot === '1' || frozen !== null, frozen };
}
function playedAlready(): boolean {
  try { return window.sessionStorage.getItem(PLAYED_KEY) === '1'; } catch { return false; }
}
function markPlayed(): void {
  try { window.sessionStorage.setItem(PLAYED_KEY, '1'); } catch { /* private mode */ }
}
function prefersReducedMotion(): boolean {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}

export default function BootScreen() {
  const { ready, loading, error, statusReady, refresh } = useApp();
  const flags = useMemo(readFlags, []);
  const reduce = useMemo(prefersReducedMotion, []);

  /* Lazy init so the app never paints for a frame before the overlay exists. */
  const [show, setShow] = useState<boolean>(() => !flags.skip && (flags.hold || !playedAlready()));
  const [closing, setClosing] = useState(false);
  const [fontsReady, setFontsReady] = useState(false);
  const [settled, setSettled] = useState(false);
  const [handover, setHandover] = useState(false);
  const [online, setOnline] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const peak = useRef(0);
  const started = useRef(Date.now());
  const closed = useRef(false);

  /* 1 — webfonts, with a short timeout so a slow CDN can never stall startup. */
  useEffect(() => {
    let alive = true;
    const done = () => { if (alive) setFontsReady(true); };
    const fonts = typeof document === 'undefined' ? undefined : document.fonts;
    if (fonts && fonts.ready) void fonts.ready.then(done).catch(done); else done();
    const t = window.setTimeout(done, 1500);
    return () => { alive = false; window.clearTimeout(t); };
  }, []);

  /* 2/3 — the catalogue request settling is the real signal for both stages. */
  useEffect(() => { if (!loading) setSettled(true); }, [loading]);

  /* 4 — connection state, so the offline path is honest rather than guessed. */
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    setOnline(navigator.onLine !== false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);

  const completed = useMemo(
    () => [fontsReady, statusReady, settled, ready].filter(Boolean).length,
    [fontsReady, statusReady, settled, ready]
  );
  useEffect(() => { if (completed > peak.current) peak.current = completed; }, [completed]);

  useEffect(() => {
    if (flags.frozen !== null || handover || completed < 4) return;
    const t = window.setTimeout(() => setHandover(true), reduce ? 0 : SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [completed, handover, reduce, flags.frozen]);

  /* Stage index is capped so it can never regress or overshoot. */
  const stageIndex = flags.frozen !== null
    ? flags.frozen
    : Math.min(peak.current + (handover ? 1 : 0), STAGE_COUNT);
  const finished = stageIndex >= STAGE_COUNT;
  const pct = Math.round((stageIndex / STAGE_COUNT) * 100);

  const close = useCallback(() => {
    if (closed.current) return;
    closed.current = true;
    markPlayed();
    setClosing(true);
    window.setTimeout(() => setShow(false), reduce ? 0 : FADE_MS);
  }, [reduce]);

  /* Auto hand-over, but only once the intro has had a fair showing. */
  useEffect(() => {
    if (flags.hold || closed.current || !finished) return;
    const wait = Math.max(0, MIN_SHOW_MS - (Date.now() - started.current)) + SETTLE_MS;
    const t = window.setTimeout(close, wait);
    return () => window.clearTimeout(t);
  }, [flags.hold, finished, close]);

  useEffect(() => {
    if (flags.hold) return;
    const t = window.setTimeout(close, HARD_CAP_MS);
    return () => window.clearTimeout(t);
  }, [flags.hold, close]);

  useEffect(() => {
    if (!show) return;
    const root = document.documentElement;
    root.classList.add('pbd-booting');
    return () => root.classList.remove('pbd-booting');
  }, [show]);

  useEffect(() => {
    if (!show) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [show, close]);

  const retry = useCallback(async () => {
    setRetrying(true);
    try { await refresh(); } finally { setRetrying(false); }
  }, [refresh]);

  if (!show) return null;

  const offline = !online;
  const degraded = offline || Boolean(error);

  return (
    <div className={`mx-boot${closing ? ' is-out' : ''}`} role="status" aria-live="polite" aria-busy={!finished}>
      <div className="mx-boot-card">
        <span className="mx-boot-sheen" aria-hidden="true" />

        <div className="mx-boot-mark" aria-hidden="true">
          <span className="mx-boot-ring" />
          <img className="mx-boot-glyph" src={BRAND.mark} alt={BRAND.name} width={64} height={64} />
        </div>

        <h1 className="mx-boot-title">PlayBeat Digital</h1>
        <p className="mx-boot-sub">{finished ? 'Ready' : 'Starting up'}</p>

        <div className="mx-boot-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100}
             aria-valuenow={pct} aria-label="Startup progress">
          <span className="mx-boot-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="mx-boot-meta">
          <span>{pct}%</span>
          <span>{finished ? 'Complete' : `Stage ${Math.min(stageIndex + 1, STAGE_COUNT)} of ${STAGE_COUNT}`}</span>
        </div>

        <ul className="mx-boot-steps">
          {STAGES.map((s, i) => {
            const state: StageState = i < stageIndex ? 'done' : i === stageIndex ? 'active' : 'pending';
            return (
              <li key={s.key} className={`mx-boot-step is-${state}`}>
                <span className="mx-boot-dot" aria-hidden="true">{state === 'done' ? '✓' : ''}</span>
                <span className="mx-boot-step-text"><b>{s.label}</b><i>{s.detail}</i></span>
              </li>
            );
          })}
        </ul>

        {degraded ? (
          <div className="mx-boot-note is-warn">
            <b>{offline ? 'You appear to be offline' : 'The streaming API did not answer'}</b>
            <p>{offline
              ? 'PlayBeat Digital keeps your favourites and saved playlist on this device and reconnects automatically the moment the connection returns.'
              : (error ?? 'The sports data API could not be reached.')}</p>
            <p>In the meantime the clearly-labelled demo catalogue is used, so no part of the interface breaks.</p>
            <div className="mx-boot-actions">
              <button className="mx-boot-btn" type="button" onClick={() => void retry()} disabled={retrying}>
                {retrying ? 'Retrying…' : 'Try again'}
              </button>
              <button className="mx-boot-btn is-ghost" type="button" onClick={close}>
                Continue to PlayBeat Digital
              </button>
            </div>
          </div>
        ) : (
          <div className="mx-boot-note">
            Playback is restricted to signed-in viewers so provider connection limits and licence terms are
            respected. Provider credentials stay server-side — this browser only ever receives short-lived,
            opaque playback tokens.
          </div>
        )}

        {flags.hold ? (
          <button className="mx-boot-btn is-wide" type="button" onClick={close} disabled={!finished && !degraded}>
            {finished ? 'Continue to PlayBeat Digital' : 'Loading…'}
          </button>
        ) : !finished && (
          <button className="mx-boot-skip" type="button" onClick={close}>Skip intro</button>
        )}
      </div>
    </div>
  );
}
