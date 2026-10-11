import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import MatchCard from '../components/MatchCard';
import { Empty, SectionHead } from '../components/common';
import { isLiveNow } from '../lib/format';

export default function Favorites() {
  const { catalog, favorites, toggleFavorite } = useApp();
  const list = catalog.matches.filter((m) => favorites.includes(m.id));
  const live = list.filter(isLiveNow);
  const upcoming = list.filter((m) => m.status === 'upcoming');

  return (
    <div className="wrap wrap-wide sec">
      <SectionHead eyebrow="Saved" title="My favourites"
        sub="Everything you have saved, ready to open in the player. Favourites are stored on this device in the demo build."
        action={list.length > 0 ? <button className="btn btn-ghost" onClick={() => list.forEach((m) => toggleFavorite(m.id))}>Clear all</button> : undefined} />

      {list.length === 0 ? (
        <Empty title="Nothing saved yet" body="Tap the heart on a match card or in the player control bar and it will appear here."
          action={<Link className="btn btn-lime" to="/live">Browse live sports</Link>} />
      ) : (
        <>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', marginBottom: 22 }}>
            <div className="kpi"><b>{list.length}</b><small>Saved matches</small></div>
            <div className="kpi"><b>{live.length}</b><small>Live right now</small></div>
            <div className="kpi"><b>{upcoming.length}</b><small>Starting soon</small></div>
          </div>
          <div className="grid-cards">{list.map((m) => <MatchCard key={m.id} m={m} />)}</div>
        </>
      )}
    </div>
  );
}
