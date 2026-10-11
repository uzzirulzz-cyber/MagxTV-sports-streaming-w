import { Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import LiveSports from './pages/LiveSports';
import SportPage from './pages/SportPage';
import Highlights from './pages/Highlights';
import Schedule from './pages/Schedule';
import WatchMatch from './pages/WatchMatch';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Search from './pages/Search';
import Favorites from './pages/Favorites';
import Credits from './pages/Credits';
import Connect from './pages/Connect';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/live" element={<LiveSports />} />
        <Route path="/football" element={<SportPage sport="football" />} />
        <Route path="/cricket" element={<SportPage sport="cricket" />} />
        <Route path="/basketball" element={<SportPage sport="basketball" />} />
        <Route path="/tennis" element={<SportPage sport="tennis" />} />
        <Route path="/motorsports" element={<SportPage sport="motorsport" />} />
        <Route path="/highlights" element={<Highlights />} />
        <Route path="/schedule" element={<Schedule />} />
        <Route path="/watch/:id" element={<WatchMatch />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/search" element={<Search />} />
        <Route path="/login" element={<Login />} />
        <Route path="/connect" element={<Connect />} />
        <Route path="/credits" element={<Credits />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
