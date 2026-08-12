'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  getServerAuthState,
  ORGANIZATION_CONTEXT_COOKIE,
  ROLE_CONTEXT_COOKIE,
} from '@/lib/auth/server-context';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
});

export type LoginState = {
  error: string | null;
};

const contextCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function loginAction(
  _previousState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });

  if (!parsed.success) {
    return { error: 'تحقق من البريد الإلكتروني وكلمة المرور.' };
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: 'تعذر تسجيل الدخول. تحقق من بيانات الحساب ثم أعد المحاولة.' };
  }

  // Never carry a previous account's workspace context into a new session.
  // Persist auto-resolved single choices so Proxy can give a clear denial page
  // before a disallowed server workspace is rendered.
  const cookieStore = await cookies();
  cookieStore.delete(ORGANIZATION_CONTEXT_COOKIE);
  cookieStore.delete(ROLE_CONTEXT_COOKIE);
  const context = await getServerAuthState();
  if (context.organizationId) {
    cookieStore.set(ORGANIZATION_CONTEXT_COOKIE, context.organizationId, contextCookieOptions);
  }
  if (context.activeRole) {
    cookieStore.set(ROLE_CONTEXT_COOKIE, context.activeRole, contextCookieOptions);
  }

  redirect('/context');
}

export async function logoutAction() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete(ROLE_CONTEXT_COOKIE);
  cookieStore.delete(ORGANIZATION_CONTEXT_COOKIE);
  redirect('/login');
}
