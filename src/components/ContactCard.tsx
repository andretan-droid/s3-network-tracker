import type { Contact } from '../types';
import { FREQUENCY_LABELS, FREQUENCY_DAYS, TYPE_LABELS } from '../types';

interface Props {
  contact: Contact;
  onMarkTouched: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
}

function daysSince(dateStr: string): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
}

function isDue(c: Contact): boolean {
  if (!c.lastTouched) return true;
  const days = (Date.now() - new Date(c.lastTouched).getTime()) / 86_400_000;
  return days >= FREQUENCY_DAYS[c.frequency];
}

const heatColors = { hot: 'var(--hot)', warm: 'var(--warm)', cold: 'var(--cold)' };

const badgeClasses: Record<string, string> = {
  client: 'badge-client',
  capital_provider: 'badge-capital',
  partner: 'badge-partner',
  unclassified: 'badge-unclassified',
};

export default function ContactCard({ contact: c, onMarkTouched, onEdit, onDelete }: Props) {
  const days = daysSince(c.lastTouched);
  const due = isDue(c);
  const meta = [c.position, c.company, c.eventMet ? `met at ${c.eventMet}` : ''].filter(Boolean).join(' · ');

  return (
    <div className="contact-card">
      <div className={`avatar ${c.type}`}>{initials(c.name)}</div>
      <div className="contact-main">
        <div className="contact-name">{c.name}</div>
        <div className="contact-meta">{meta}</div>
        {c.notes && (
          <div className="contact-note">
            {c.notes.length > 90 ? c.notes.substring(0, 90) + '…' : c.notes}
          </div>
        )}
        <div className="card-actions">
          <button className="action-btn touch" onClick={() => onMarkTouched(c.id)}>
            Mark touched
          </button>
          <button className="action-btn" onClick={() => onEdit(c.id)}>Edit</button>
          <button className="action-btn danger" onClick={() => onDelete(c.id)}>Delete</button>
          {c.email && <a href={`mailto:${c.email}`} className="action-btn">Email</a>}
          {c.phoneMobile && <a href={`tel:${c.phoneMobile}`} className="action-btn">Call</a>}
        </div>
      </div>
      <div className="contact-right">
        <span className={`badge ${badgeClasses[c.type]}`}>{TYPE_LABELS[c.type]}</span>
        <div className="heat-row">
          <div className="heat-dot" style={{ background: heatColors[c.heat] }} />
          <span className="freq-tag">{FREQUENCY_LABELS[c.frequency]}</span>
          {due && <span className="due-icon" title="Due for touch">&#128276;</span>}
        </div>
        <span className="days-tag">
          {days === null ? 'Never touched' : `${days}d ago`}
        </span>
        {c.owners && <span className="owner-tag">by {c.owners}</span>}
      </div>
    </div>
  );
}
