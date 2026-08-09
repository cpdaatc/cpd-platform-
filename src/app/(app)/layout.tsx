import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import {
  AuthenticationRequiredError,
  ContextSelectionRequiredError,
  requireServerAuthContext,
  type RequiredServerAuthContext,
} from '@/lib/auth/server-context';

export default async function ProtectedAppLayout({ children }: { children: ReactNode }) {
  let context: RequiredServerAuthContext;

  try {
    context = await requireServerAuthContext();
  } catch (error) {
    if (error instanceof AuthenticationRequiredError) {
      redirect('/login');
    }
    if (error instanceof ContextSelectionRequiredError) {
      redirect('/context');
    }
    throw error;
  }

  return <AppShell context={context}>{children}</AppShell>;
}
