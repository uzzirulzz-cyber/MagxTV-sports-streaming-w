import { useCallback, useEffect, useRef, useState } from 'react';
import type Hls from 'hls.js';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { clock, dayLabel, pad } from '../lib/format';
import { DEMO_STREAMS, isAllowed } from '../data/streams';
import type { Match } from '../lib/types';
import { Crest } from './common';

type Gate = 'loading' | 'ready' | 'signin' | 'no-source' | 'blocked' | 'error';

export default function VideoPlayer({ match, titleLine, onEnded }: { match: Match; titleLine?: string; onEnded?: () => void }) {
  const { user, toast, isFavorite, toggleFavorite } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [gate, setGate] = useState<Gate>('loading');
  const [detail, setDetail] = useState('');
  const [sourceIdx, setSourceIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [isFull, setFull] = useState(false);
  const [controls, setControls] = useState(true);
  const [quality, setQuality] = useState('auto');
  const [levels, setLevels] = useState<{ i: number; label: string }[]>([]);
  const [pipOk] = useState(() => typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled);

  const src = match.streamPath;
  const licence = DEMO_STREAMS[sourceIdx % DEMO_STREAMS.length]?.licence ?? 'Openly licensed source';

  const teardown = useCallback(() => {
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    const v = videoRef.current;
    if (v) { v.removeAttribute('src'); try { v.load(); } catch { /* ignore */ } }
    setLevels([]);
  }, []);

  const attach = useCallback(async () => {
    teardown();
    const v = videoRef.current;
    if (!src) { setGate('no-source'); setDetail('No authorised stream is configured for this fixture yet.'); return; }
    if (!isAllowed(src)) { setGate('blocked'); setDetail('The configured source is not on the stream allow-list, so playback was refused.'); return; }
    if (!user) { setGate('signin'); setDetail('Sign in to start this stream.'); return; }
    if (!v) return;
    setGate('loading'); setDetail('Buffering the stream…');
    const isHls = /\.m3u8($|\?)/i.test(src);
    if (!isHls) {
      v.src = src; setGate('ready');
      try { await v.play(); setPlaying(true); } catch { setPlaying(false); }
      return;
    }
    try {
      const mod = await import('hls.js');
      const HlsCtor = mod.default;
      if (HlsCtor.isSupported()) {
        const hls = new HlsCtor({ lowLatencyMode: true, enableWorker: true, maxBufferLength: 24 });
        hlsRef.current = hls;
        hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
          setLevels(hls.levels.map((l, i) => ({ i, label: l.height ? `${l.height}p` : `${Math.round((l.bitrate || 0) / 1000)}k` })));
          setGate('ready');
          v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
        });
        hls.on(HlsCtor.Events.LEVEL_SWITCHED, (_e, d) => {
          const l = hls.levels[d.level];
          if (quality === 'auto' && l) setDetail(`Auto · ${l.height ? l.height + 'p' : Math.round((l.bitrate || 0) / 1000) + 'k'}`);
        });
        hls.on(HlsCtor.Events.ERROR, (_e, d) => {
          if (!d.fatal) return;
          setGate('error');
          setDetail(d.type === HlsCtor.ErrorTypes.NETWORK_ERROR
            ? 'The stream source could not be reached. Check the network or try another camera.'
            : 'This stream could not be decoded by the browser.');
        });
        hls.loadSource(src);
        hls.attachMedia(v);
      } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
        v.src = src; setGate('ready');
        v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      } else {
        setGate('error'); setDetail('HLS playback is not supported in this browser.');
      }
    } catch {
      setGate('error'); setDetail('The playback library failed to load. Reload the page to try again.');
    }
  }, [src, user, quality, teardown]);

  useEffect(() => { void attach(); return teardown; }, [attach, teardown, sourceIdx]);

  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    const onTime = () => setTime(v.currentTime);
    const onMeta = () => setDuration(v.duration || 0);
    const onEnd = () => { setPlaying(false); onEnded?.(); };
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onMeta);
    v.addEventListener('ended', onEnd);
    return () => { v.removeEventListener('timeupdate', onTime); v.removeEventListener('loadedmetadata', onMeta); v.removeEventListener('ended', onEnd); };
  }, [onEnded]);

  useEffect(() => {
    const v = videoRef.current; if (!v) return;
    v.muted = muted; v.volume = volume; v.playbackRate = rate;
  }, [muted, volume, rate]);

  useEffect(() => {
    const h = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  const togglePlay = () => {
    const v = videoRef.current; if (!v || gate !== 'ready') return;
    if (v.paused) { v.play().then(() => setPlaying(true)).catch(() => toast('Playback was blocked by the browser', 'bad')); }
    else { v.pause(); setPlaying(false); }
  };
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current; if (!v || !duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    v.currentTime = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * duration;
  };
  const fullscreen = () => {
    const shell = videoRef.current?.parentElement;
    if (!shell) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void shell.requestFullscreen?.();
  };
  const pip = async () => {
    const v = videoRef.current; if (!v) return;
    try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else await v.requestPictureInPicture(); }
    catch { toast('Picture-in-picture is unavailable here', 'bad'); }
  };
  const applyQuality = (value: string) => {
    setQuality(value);
    const hls = hlsRef.current; if (!hls) return;
    hls.currentLevel = value === 'auto' ? -1 : Number(value);
  };
  const skip = (s: number) => { const v = videoRef.current; if (v) v.currentTime = Math.max(0, Math.min(duration || 0, v.currentTime + s)); };

  const showOverlay = gate !== 'ready';
  const fmt = (s: number) => (Number.isFinite(s) && s > 0 ? `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}` : '--:--');

  return (
    <div className="player-shell" onMouseMove={() => setControls(true)} onMouseLeave={() => playing && setControls(false)}>
      <video ref={videoRef} playsInline controls={false} poster={match.thumb} onClick={togglePlay} aria-label={`${match.home.name} versus ${match.away.name} stream`} />

      {(gate === 'ready' && !playing) && (
        <button className="pl-btn" aria-label="Play" onClick={togglePlay}
          style={{ position: 'absolute', inset: 0, margin: 'auto', width: 74, height: 74, zIndex: 4, borderColor: 'var(--lime)' }}>
          <svg viewBox="0 0 24 24" width="30" height="30" fill="currentColor"><path d="M8 5v14l11-7Z" /></svg>
        </button>
      )}

      {showOverlay && (
        <div className="player-overlay">
          <div className="gate">
            {gate === 'loading' && <><div className="spin" style={{ fontSize: 30, display: 'inline-block' }}>◌</div><h3>Opening the stream…</h3></>}
            {gate === 'signin' && <><span style={{ fontSize: 34 }}>🔒</span><h3>Sign in to watch</h3>
              <p className="muted">{detail} Playback is restricted to signed-in viewers so that streams stay licensed and rate-limited.</p>
              <div className="row" style={{ gap: 10, justifyContent: 'center' }}>
                <Link className="btn btn-lime" to="/login">Sign in</Link>
                <Link className="btn btn-ghost" to="/login?mode=register">Create account</Link>
              </div></>}
            {gate === 'no-source' && <><span style={{ fontSize: 34 }}>📡</span><h3>No authorised source configured</h3>
              <p className="muted">{detail} Add a licensed origin in <code>.env</code> (SPORTS_PROVIDER / STREAM_ALLOWLIST) and this fixture will play.</p></>}
            {gate === 'blocked' && <><span style={{ fontSize: 34 }}>⛔</span><h3>Source refused</h3><p className="muted">{detail}</p></>}
            {gate === 'error' && <><span style={{ fontSize: 34 }}>⚠️</span><h3>Playback problem</h3><p className="muted">{detail}</p>
              <button className="btn btn-lime" onClick={() => void attach()}>Retry stream</button></>}
            {gate !== 'error' && gate !== 'signin' && gate !== 'no-source' && gate !== 'blocked' && gate !== 'loading' && null}
          </div>
        </div>
      )}

      <div className={`pl-controls${controls ? '' : ' hide'}`}>
        <div className="pl-bar" onClick={seek} role="slider" aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.round(duration)} aria-valuenow={Math.round(time)} tabIndex={0}>
          <div className="fill" style={{ width: `${duration ? (time / duration) * 100 : 0}%` }} />
        </div>
        <div className="pl-btns">
          <button className="pl-btn" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
            {playing ? <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M7 5h4v14H7zm6 0h4v14h-4z" /></svg>
              : <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M8 5v14l11-7Z" /></svg>}
          </button>
          <button className="pl-btn" onClick={() => skip(-10)} aria-label="Back 10 seconds">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8Z" /></svg>
          </button>
          <button className="pl-btn" onClick={() => skip(10)} aria-label="Forward 10 seconds">
            <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"><path d="M12 5V1l5 5-5 5V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8Z" /></svg>
          </button>
          <button className="pl-btn" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Unmute' : 'Mute'}>
            {muted ? '🔇' : '🔊'}
          </button>
          <input type="range" min={0} max={1} step={0.05} value={muted ? 0 : volume} aria-label="Volume"
            onChange={(e) => { const val = Number(e.target.value); setVolume(val); setMuted(val === 0); }} style={{ width: 76 }} />
          <span className="pl-time mono">{fmt(time)} / {fmt(duration)}</span>
          <span className="pl-title">{titleLine ?? `${match.home.name} vs ${match.away.name}`}</span>
          {levels.length > 0 && (
            <select className="pl-select" value={quality} onChange={(e) => applyQuality(e.target.value)} aria-label="Quality">
              <option value="auto">Auto</option>
              {levels.map((l) => <option key={l.i} value={String(l.i)}>{l.label}</option>)}
            </select>
          )}
          <select className="pl-select" value={rate} onChange={(e) => setRate(Number(e.target.value))} aria-label="Playback speed">
            {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => <option key={r} value={r}>{r}×</option>)}
          </select>
          {DEMO_STREAMS.length > 1 && (
            <select className="pl-select" value={sourceIdx} onChange={(e) => setSourceIdx(Number(e.target.value))} aria-label="Camera / source">
              {DEMO_STREAMS.map((s, i) => <option key={s.path} value={i}>{s.label}</option>)}
            </select>
          )}
          {pipOk && <button className="pl-btn" onClick={pip} aria-label="Picture in picture">⧉</button>}
          <button className="pl-btn" onClick={fullscreen} aria-label="Fullscreen">{isFull ? '⤡' : '⤢'}</button>
          <button className="pl-btn" onClick={() => toggleFavorite(match.id)} aria-label="Favourite this match"
            style={{ color: isFavorite(match.id) ? 'var(--lime)' : undefined, borderColor: isFavorite(match.id) ? 'var(--lime)' : undefined }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M12 21s-7.5-4.8-9.4-9A5.6 5.6 0 0 1 12 5.6 5.6 5.6 0 0 1 21.4 12c-1.9 4.2-9.4 9-9.4 9Z" /></svg>
          </button>
        </div>
      </div>

      <div className="row-between" style={{ padding: '10px 14px', background: 'rgba(4,8,26,.75)', borderTop: '1px solid var(--line)' }}>
        <span className="row" style={{ gap: 10 }}>
          <Crest name={match.home.name} color={match.home.color} short={match.home.short} size="sm" />
          <span className="small">{match.home.name} <b className="mono">{match.status !== 'upcoming' ? match.homeScore : ''}</b> – <b className="mono">{match.status !== 'upcoming' ? match.awayScore : ''}</b> {match.away.name}</span>
          <Crest name={match.away.name} color={match.away.color} short={match.away.short} size="sm" />
        </span>
        <span className="muted tiny">{dayLabel(match.kickoff)} {clock(match.kickoff)} · {match.venue} · Source licence: {licence}</span>
      </div>
    </div>
  );
}
