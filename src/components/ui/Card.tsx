import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  compact?: boolean;
  flat?: boolean;
}

export function Card({ children, className = '', compact, flat }: CardProps) {
  const cls = [
    'ui-card',
    compact && 'ui-card--compact',
    flat && 'ui-card--flat',
    className,
  ].filter(Boolean).join(' ');
  return <section className={cls}>{children}</section>;
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <header className="ui-card-head">
      <div className="ui-card-head__row">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action && <div>{action}</div>}
      </div>
    </header>
  );
}

export function CardFooter({ children }: { children: ReactNode }) {
  return <footer className="ui-card-foot">{children}</footer>;
}
