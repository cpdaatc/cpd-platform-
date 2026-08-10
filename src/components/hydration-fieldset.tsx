'use client';

import { useEffect, useState, type ReactNode } from 'react';

export function HydrationFieldset({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <fieldset
      disabled={!hydrated}
      aria-busy={!hydrated}
      data-hydrated={hydrated ? 'true' : 'false'}
      className="contents"
    >
      {children}
    </fieldset>
  );
}
