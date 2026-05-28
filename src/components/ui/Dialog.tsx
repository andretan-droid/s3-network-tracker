import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';
import { AlertTriangle, Info, Trash2 } from './icons';

type DialogTone = 'danger' | 'warn' | 'info';

interface DialogOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
}

type ConfirmFn = (opts: DialogOptions) => Promise<boolean>;
type AlertFn = (opts: Omit<DialogOptions, 'cancelLabel'>) => Promise<void>;

interface DialogContextValue {
  confirm: ConfirmFn;
  alert: AlertFn;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within DialogProvider');
  return ctx;
}

interface DialogState {
  opts: DialogOptions;
  isConfirm: boolean;
  resolve: (result: boolean) => void;
}

function ToneIcon({ tone }: { tone: DialogTone }) {
  if (tone === 'danger') return <Trash2 />;
  if (tone === 'warn') return <AlertTriangle />;
  return <Info />;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);

  const confirm = useCallback<ConfirmFn>(
    opts =>
      new Promise<boolean>(resolve => {
        setState({ opts, isConfirm: true, resolve });
      }),
    []
  );

  const alert = useCallback<AlertFn>(
    opts =>
      new Promise<void>(resolve => {
        setState({ opts, isConfirm: false, resolve: () => resolve() });
      }),
    []
  );

  const close = useCallback(
    (result: boolean) => {
      if (state) {
        state.resolve(result);
        setState(null);
      }
    },
    [state]
  );

  // Escape key closes (treated as cancel)
  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
      if (e.key === 'Enter') close(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, close]);

  const tone: DialogTone = state?.opts.tone ?? 'info';
  const confirmLabel = state?.opts.confirmLabel ?? (state?.isConfirm ? 'Confirm' : 'OK');
  const cancelLabel = state?.opts.cancelLabel ?? 'Cancel';

  return (
    <DialogContext.Provider value={{ confirm, alert }}>
      {children}
      {state && (
        <div
          className="ui-dialog-backdrop"
          onClick={() => close(false)}
          role="presentation"
        >
          <div
            className="ui-dialog"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="ui-dialog-title"
          >
            <div className="ui-dialog__head">
              <div className={`ui-dialog__icon ui-dialog__icon--${tone}`} aria-hidden>
                <ToneIcon tone={tone} />
              </div>
              <div style={{ flex: 1, paddingTop: 6 }}>
                <div id="ui-dialog-title" className="ui-dialog__title">
                  {state.opts.title}
                </div>
              </div>
            </div>
            {state.opts.body && (
              <div className="ui-dialog__body">{state.opts.body}</div>
            )}
            <div className="ui-dialog__foot">
              {state.isConfirm && (
                <Button variant="ghost" onClick={() => close(false)}>
                  {cancelLabel}
                </Button>
              )}
              <Button variant="primary" onClick={() => close(true)} autoFocus>
                {confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}
