import { Link } from 'react-router-dom';
import { Empty } from '../components/common';

export default function NotFound() {
  return (
    <div className="wrap sec">
      <Empty title="That page does not exist" body="The link may be out of date. Use the navigation above, or jump straight to what is live."
        action={<div className="row" style={{ gap: 10 }}><Link className="btn btn-lime" to="/live">Live sports</Link><Link className="btn btn-ghost" to="/">Home</Link></div>} />
    </div>
  );
}
