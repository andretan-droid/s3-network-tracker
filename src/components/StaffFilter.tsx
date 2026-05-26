import { STAFF_ROSTER } from '../types';

interface Props {
  value: string;
  onChange: (val: string) => void;
}

export default function StaffFilter({ value, onChange }: Props) {
  const eds = STAFF_ROSTER.filter(s => s.level === 'executive_director');
  const ads = STAFF_ROSTER.filter(s => s.level === 'associate_director');
  const staff = STAFF_ROSTER.filter(s => s.level === 'staff');

  return (
    <select
      className="sidebar-staff-select"
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <option value="all">Firm-wide (all contacts)</option>
      <optgroup label="Executive Directors">
        {eds.map(s => (
          <option key={s.id} value={s.name}>{s.name}</option>
        ))}
      </optgroup>
      <optgroup label="Associate Directors">
        {ads.map(s => (
          <option key={s.id} value={s.name}>{s.name}</option>
        ))}
      </optgroup>
      <optgroup label="Staff">
        {staff.map(s => (
          <option key={s.id} value={s.name}>{s.name}</option>
        ))}
      </optgroup>
    </select>
  );
}
