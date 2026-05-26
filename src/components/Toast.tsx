import { useEffect, useState, useCallback, createContext, useContext } from 'react';

type ToastFn = (msg: string) => void;
const ToastContext = createContext<ToastFn>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);

  const toast = useCallback((msg: string) => {
    setMessage(msg);
    setVisible(true);
    setTimeout(() => setVisible(false), 2400);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className={`toast ${visible ? 'show' : ''}`}>{message}</div>
    </ToastContext.Provider>
  );
}
