import type { ReactNode } from 'react';

type Tone = 'default' | 'alert' | 'accent';

interface StatProps {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
  onClick?: () => void;
}

export function Stat({ label, value, hint, tone = 'default', onClick }: StatProps) {
  const cls = [
    'ui-stat',
    onClick && 'ui-stat--clickable',
  ].filter(Boolean).join(' ');

  const valueCls = [
    'ui-stat__value',
    tone !== 'default' && `ui-stat__value--${tone}`,
  ].filter(Boolean).join(' ');

  const content = (
    <>
      <span className={valueCls}>{value}</span>
      <span className="ui-stat__label">{label}</span>
      {hint && <span className="ui-stat__hint">{hint}</span>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick}>
        {content}
      </button>
    );
  }
  return <div className={cls}>{content}</div>;
}
