'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  getServerAuthState,
  ORGANIZATION_CONTEXT_COOKIE,
  ROLE_CONTEXT_COOKIE,
} from '@/lib/auth/server-context';
import { GOVERNANCE_ROLES } from '@/lib/auth/permissions';

const organizationSchema = z.string().uuid();
const roleSchema = z.enum(GOVERNANCE_ROLES);

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function selectOrganizationAction(formData: FormData) {
  const organizationId = organizationSchema.safeParse(formData.get('organizationId'));
  if (!organizationId.success) {
    redirect('/context?error=invalid-organization');
  }

  const supabase = await createServerSupabaseClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    redirect('/login');
  }

  const { data: membership } = await supabase
    .from('organization_memberships')
    .select('id')
    .eq('organization_id', organizationId.data)
    .eq('user_id', authData.user.id)
    .eq('status', 'ACTIVE')
    .maybeSingle();

  if (!membership) {
    redirect('/context?error=invalid-organization');
  }

  const cookieStore = await cookies();
  cookieStore.set(ORGANIZATION_CONTEXT_COOKIE, organizationId.data, cookieOptions);
  cookieStore.delete(ROLE_CONTEXT_COOKIE);
  redirect('/context');
}

export async function selectRoleAction(formData: FormData) {
  const role = roleSchema.safeParse(formData.get('role'));
  if (!role.success) {
    redirect('/context?error=invalid-role');
  }

  const state = await getServerAuthState();
  if (!state.organizationId || !state.assignedRoles.includes(role.data)) {
    redirect('/context?error=invalid-role');
  }

  const cookieStore = await cookies();
  cookieStore.set(ROLE_CONTEXT_COOKIE, role.data, cookieOptions);
  redirect('/dashboard');
}
