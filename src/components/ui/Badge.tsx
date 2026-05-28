import type { ReactNode } from 'react';

type Tone = 'client' | 'capital' | 'partner' | 'educational' | 'neutral' | 'accent' | 'danger' | 'warn';

interface BadgeProps {
  tone?: Tone;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', children }: BadgeProps) {
  return <span className={`ui-badge ui-badge--${tone}`}>{children}</span>;
}
