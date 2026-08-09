import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import {
  AuthenticationRequiredError,
  ContextSelectionRequiredError,
  requireServerAuthContext,
} from '@/lib/auth/server-context';

export default async function ProtectedAppLayout({ children }: { children: ReactNode }) {
  try {
    const context = await requireServerAuthContext();
    return <AppShell context={context}>{children}</AppShell>;
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect('/login');
    }
    if (error instanceof ContextSelectionRequiredError) {
      redirect('/context');
    }
    throw error;
  }
}
