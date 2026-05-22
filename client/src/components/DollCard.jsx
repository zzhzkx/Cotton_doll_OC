import { Link } from 'react-router-dom';
import './DollCard.css';

export default function DollCard({ doll }) {
  return (
    <Link to={`/doll/${doll.id}`} className="doll-card fade-in-up">
      <div className="doll-card-avatar">
        {doll.avatar ? (
          <img src={doll.avatar} alt={doll.name} />
        ) : (
          <div className="avatar-placeholder">
            {doll.name.charAt(0)}
          </div>
        )}
      </div>
      <div className="doll-card-info">
        <h3 className="doll-card-name">{doll.name}</h3>
        <p className="doll-card-bio">{doll.bio || '这个娃娃还没有简介~'}</p>
      </div>
    </Link>
  );
}
