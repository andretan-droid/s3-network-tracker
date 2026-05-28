import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown } from './icons';

interface DisclosureProps {
  label: string;
  hint?: string;
  defaultOpen?: boolean;
  /** Controlled open state. If provided, defaultOpen is ignored. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  badge?: ReactNode;
  children: ReactNode;
}

/**
 * Collapsible section with header + optional hint + chevron.
 * Use uncontrolled (defaultOpen) for stateless cases; controlled (open + onOpenChange)
 * when the parent needs to react to open/close (e.g. to track form completeness).
 */
export function Disclosure({
  label,
  hint,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  badge,
  children,
}: DisclosureProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

  const toggle = () => {
    const next = !isOpen;
    if (!isControlled) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  return (
    <div className={`ui-disclosure ${isOpen ? 'ui-disclosure--open' : ''}`}>
      <button
        type="button"
        className="ui-disclosure__head"
        onClick={toggle}
        aria-expanded={isOpen}
      >
        <span className={`ui-disclosure__chev ${isOpen ? 'ui-disclosure__chev--open' : ''}`} aria-hidden>
          <ChevronDown />
        </span>
        <span className="ui-disclosure__label">
          {label}
          {hint && <span className="ui-disclosure__hint">{hint}</span>}
        </span>
        {badge && <span className="ui-disclosure__badge">{badge}</span>}
      </button>
      {isOpen && <div className="ui-disclosure__body">{children}</div>}
    </div>
  );
}
