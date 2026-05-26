import { useState } from 'react';
import type { Contact, ContactType } from '../types';
import ContactCard from './ContactCard';

type FilterType = 'all' | ContactType | 'hot';

interface Props {
  contacts: Contact[];
  onMarkTouched: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const filters: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'client', label: 'Clients' },
  { key: 'capital_provider', label: 'Capital providers' },
  { key: 'partner', label: 'Partners' },
  { key: 'hot', label: 'Hot leads' },
];

export default function ContactsList({ contacts, onMarkTouched, onEdit, onDelete }: Props) {
  const [filter, setFilter] = useState<FilterType>('all');
  const [query, setQuery] = useState('');

  const filtered = contacts
    .filter(c => {
      if (filter === 'hot') return c.heat === 'hot';
      if (filter !== 'all') return c.type === filter;
      return true;
    })
    .filter(c => {
      if (!query) return true;
      const q = query.toLowerCase();
      return c.name.toLowerCase().includes(q) || c.company.toLowerCase().includes(q);
    });

  return (
    <>
      <div className="filters">
        {filters.map(f => (
          <button
            key={f.key}
            className={`filter-btn ${filter === f.key ? 'active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        <input
          className="search-input"
          type="text"
          placeholder="Search name or company..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>
      <div className="contacts-list">
        {filtered.length === 0 ? (
          <div className="empty">No contacts match this filter.</div>
        ) : (
          filtered.map(c => (
            <ContactCard
              key={c.id}
              contact={c}
              onMarkTouched={onMarkTouched}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </>
  );
}
