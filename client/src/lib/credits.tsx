import { type ReactNode } from 'react';
import { CreditsContext, useCreditsState } from '../hooks/useCredits';

export function CreditsProvider({ children }: { children: ReactNode }) {
  const state = useCreditsState();
  return (
    <CreditsContext.Provider value={state}>
      {children}
    </CreditsContext.Provider>
  );
}
