/* Plays a real provider channel through the server relay.
   HLS when the panel offers an .m3u8 playlist, otherwise raw MPEG-TS via mpegts.js. */
import { useCallback, useEffect, useRef, useState } from 'react';
import type Hls from 'hls.js';
import type { LiveChannel, LiveSession } from '../lib/liveProvider';
import { hlsUrl, tsUrl } from '../lib/liveProvider';

type Mode = 'idle' | 'probing' | 'hls' | 'ts' | 'error' | 'unauthorised';

export default function LiveTVPlayer({ session, channel }: { session: LiveSession; channel: LiveChannel }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpRef = useRef<any>(null);
  const [mode, setMode] = useState<Mode>('idle');
  const [detail, setDetail] = useState('');
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [levels, setLevels] = useState<{ i: number; label: string }[]>([]);
  const [quality, setQuality] = useState('auto');
  const [isFull, setFull] = useState(false);

  const teardown = useCallback(() => {
    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    if (mpRef.current) { try { mpRef.current.destroy(); } catch { /* ignore */ } mpRef.current = null; }
    const v = videoRef.current;
    if (v) { v.removeAttribute('src'); try { v.load(); } catch { /* ignore */ } }
    setLevels([]);
  }, []);

  const attach = useCallback(async () => {
    teardown();
    const v = videoRef.current;
    if (!v || !channel) return;
    setMode('probing'); setDetail('Contacting the relay and probing this channel…');
    let href = hlsUrl(session, channel.id);
    try {
      const probe = await fetch(href, { cache: 'no-store' });
      const ct = probe.headers.get('content-type') ?? '';
      if (probe.status === 401) { setMode('unauthorised'); setDetail('The provider session expired — reconnect to continue.'); return; }
      if (!probe.ok || !ct.includes('mpegurl')) {
        let msg = `This channel is not served as HLS (HTTP ${probe.status}) — switching to raw MPEG-TS.`;
        try { const j = await probe.json(); if (j?.error) msg = String(j.error); } catch { /* not json */ }
        setDetail(msg); setMode('ts'); return;
      }
    } catch {
      setMode('error'); setDetail('The relay could not be reached. Check that the API server is running.'); return;
    }

    try {
      const mod = await import('hls.js');
      const Ctor = mod.default;
      if (Ctor.isSupported()) {
        const hls = new Ctor({ lowLatencyMode: true, enableWorker: true, maxBufferLength: 20, liveSyncDurationCount: 3 });
        hlsRef.current = hls;
        hls.attachMedia(v);
        hls.on(Ctor.Events.MEDIA_ATTACHED, () => hls.loadSource(href));
        hls.on(Ctor.Events.MANIFEST_PARSED, () => {
          setLevels(hls.levels.map((l, i) => ({ i, label: l.height ? `${l.height}p` : `${Math.round((l.bitrate ?? 0) / 1000)}k` })));
          setMode('hls'); setDetail('');
          v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
        });
        hls.on(Ctor.Events.ERROR, (_e, data) => {
          if (!data.fatal) return;
          if (data.type === Ctor.ErrorTypes.NETWORK_ERROR) { setDetail('Network error while fetching this channel — retrying and falling back to MPEG-TS.'); setMode('ts'); }
          else { setMode('error'); setDetail(`Playback error: ${data.details}. The channel may be offline or at its connection limit.`); }
        });
        return;
      }
    } catch {
      setDetail('hls.js is unavailable in this browser — falling back to raw MPEG-TS.');
    }
    setMode('ts');
  }, [channel, session, teardown]);

  /* raw MPEG-TS path */
  useEffect(() => {
    if (mode !== 'ts') return;
    const v = videoRef.current;
    if (!v) return;
    let cancelled = false;
    (async () => {
      try {
        const mod: any = await import('mpegts.js');
        const mpegts = mod.default ?? mod;
        if (!mpegts.getFeatureList().mseLivePlayback) { setMode('error'); setDetail('This browser cannot play raw MPEG-TS. Try Chrome or Edge, or use an HLS channel.'); return; }
        const p = mpegts.createPlayer(
          { type: 'mpegts', isLive: true, url: tsUrl(session, channel.id) },
          { enableWorker: true, lazyLoad: false, liveBufferLatencyChasing: true, liveBufferLatencyMaxLatency: 3.0, liveBufferLatencyMinRemain: 0.5 }
        );
        if (cancelled) { p.destroy(); return; }
        mpRef.current = p;
        p.attachMediaElement(v); p.load();
        p.on(mpegts.Events.ERROR, (t: string, d: string) => { setMode('error'); setDetail(`MPEG-TS error: ${t} / ${d}.`); });
        await p.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
        setDetail('');
      } catch {
        setMode('error'); setDetail('Could not start the MPEG-TS player.');
      }
    })();
    return () => { cancelled = true; };
  }, [mode, session, channel]);

  useEffect(() => { attach(); return teardown; }, [attach, teardown]);
  useEffect(() => { const v = videoRef.current; if (v) v.muted = muted; }, [muted]);

  const toggle = () => {
    const v = videoRef.current; if (!v) return;
    if (v.paused) { v.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); } else { v.pause(); setPlaying(false); }
  };

  return (
    <div className="player">
      <video ref={videoRef} playsInline muted={muted} onClick={toggle} />
      {(mode === 'probing' || mode === 'idle') && (
        <div className="pover"><div className="spinner" /><b>{channel.name}</b><p className="small">{detail || 'Connecting…'}</p></div>
      )}
      {(mode === 'error' || mode === 'unauthorised') && (
        <div className="pover">
          <b>{mode === 'unauthorised' ? 'Session expired' : 'This channel did not start'}</b>
          <p className="small" style={{ maxWidth: 460 }}>{detail}</p>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn btn-lime" onClick={attach}>Retry</button>
            <a className="btn btn-ghost" href="/connect">Reconnect provider</a>
          </div>
        </div>
      )}
      <div className="pbar">
        <button className="pbtn" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>{playing ? '⏸' : '▶'}</button>
        <button className="pbtn" onClick={() => setMuted((m) => !m)} aria-label={muted ? 'Unmute' : 'Mute'}>{muted ? '🔇' : '🔊'}</button>
        <span className="live-dot" />
        <span className="pname">{channel.name}</span>
        <span className="pill pill-cyan">{mode === 'hls' ? 'HLS via relay' : mode === 'ts' ? 'MPEG-TS via relay' : 'Connecting'}</span>
        <span className="grow" />
        {levels.length > 1 && (
          <select className="psel" value={quality} aria-label="Quality" onChange={(e) => {
            setQuality(e.target.value);
            const h = hlsRef.current; if (!h) return;
            h.currentLevel = e.target.value === 'auto' ? -1 : Number(e.target.value);
          }}>
            <option value="auto">Auto</option>
            {levels.map((l) => <option key={l.i} value={l.i}>{l.label}</option>)}
          </select>
        )}
        <button className="pbtn" onClick={() => { const v = videoRef.current; if (v?.requestFullscreen) v.requestFullscreen().then(() => setFull(true)).catch(() => setFull(false)); }} aria-label="Fullscreen">{isFull ? '⤢' : '⛶'}</button>
      </div>
    </div>
  );
}
