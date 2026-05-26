import type { Contact } from '../types';
import { FREQUENCY_DAYS } from '../types';

interface Props {
  contacts: Contact[];
}

function isDue(c: Contact): boolean {
  if (!c.lastTouched) return true;
  const days = (Date.now() - new Date(c.lastTouched).getTime()) / 86_400_000;
  return days >= FREQUENCY_DAYS[c.frequency];
}

export default function Dashboard({ contacts }: Props) {
  const clients = contacts.filter(c => c.type === 'client');
  const capital = contacts.filter(c => c.type === 'capital_provider');
  const partners = contacts.filter(c => c.type === 'partner');
  const due = contacts.filter(isDue);

  return (
    <div className="stats-row">
      <div className="stat">
        <div className="stat-label">Total</div>
        <div className="stat-value">{contacts.length}</div>
      </div>
      <div className="stat">
        <div className="stat-label">Clients</div>
        <div className="stat-value client">{clients.length}</div>
      </div>
      <div className="stat">
        <div className="stat-label">Capital</div>
        <div className="stat-value capital">{capital.length}</div>
      </div>
      <div className="stat">
        <div className="stat-label">Partners</div>
        <div className="stat-value">{partners.length}</div>
      </div>
      <div className="stat">
        <div className="stat-label">Due for touch</div>
        <div className="stat-value alert">{due.length}</div>
      </div>
    </div>
  );
}
