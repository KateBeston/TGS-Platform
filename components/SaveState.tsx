'use client';

import { createContext, useCallback, useContext, useState } from 'react';

type Status = 'idle' | 'saving' | 'saved' | 'error';
type Ctx = { status: Status; message: string; report: (s: Status, m?: string) => void };

const SaveCtx = createContext<Ctx>({ status: 'idle', message: '', report: () => {} });
export const useSaveState = () => useContext(SaveCtx);

export function SaveStateProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');

  const report = useCallback((s: Status, m?: string) => {
    setStatus(s);
    if (s === 'saved') {
      const t = new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' });
      setMessage(`Saved · ${t}`);
    } else if (s === 'saving') setMessage('Saving…');
    else setMessage(m ?? '');
  }, []);

  return <SaveCtx.Provider value={{ status, message, report }}>{children}</SaveCtx.Provider>;
}

export function SaveIndicator() {
  const { status, message } = useSaveState();
  return <span className={`savestate ${status}`}>{message}</span>;
}
