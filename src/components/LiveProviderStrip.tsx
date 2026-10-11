import { Link } from 'react-router-dom';
import { useProviderSession } from '../lib/liveProvider';

export default function LiveProviderStrip() {
  const session = useProviderSession();
  return (
    <div className="lp-strip">
      <div className="wrap wrap-wide row-between" style={{ gap: 14, flexWrap: 'wrap' }}>
        <span className="small">
          {session
            ? <><span className="pill pill-live"><i className="live-dot" /> LIVE PROVIDER CONNECTED</span> <b style={{ marginLeft: 8 }}>{session.username}@{session.host.replace(/^https?:\/\//, '')}</b>
              <span className="muted"> · subscription {session.account.status}{session.account.expiresAt ? ` until ${String(session.account.expiresAt).slice(0, 10)}` : ''}</span></>
            : <><span className="pill pill-warn">LIVE TV NOT CONNECTED</span> <span className="muted">Showing the labelled demo catalogue. Connect your own licensed provider to stream real channels.</span></>}
        </span>
        <Link className={session ? 'btn btn-sm btn-ghost' : 'btn btn-sm btn-lime'} to="/connect">
          {session ? 'Live TV channels' : 'Connect live provider'}
        </Link>
      </div>
    </div>
  );
}
