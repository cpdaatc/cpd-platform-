import type { GovernanceRole } from '@/lib/auth/permissions';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import {
  createSupabaseActivityRepository,
  type ActivityRpcClient,
  type MembershipRoleReader,
} from './supabase-repository';

export async function createRequestActivityRepository() {
  const supabase = await createServerSupabaseClient();

  const rpcClient: ActivityRpcClient = {
    async rpc(functionName, args) {
      const { data, error } = await supabase.rpc(functionName, args);
      return {
        data,
        error: error ? { code: error.code, message: error.message } : null,
      };
    },
  };

  const membershipRoleReader: MembershipRoleReader = async (
    organizationId: string,
    membershipId: string,
    role: GovernanceRole,
  ) => {
    const { data: roleRow, error: roleError } = await supabase
      .from('roles')
      .select('id')
      .eq('code', role)
      .maybeSingle();

    if (roleError || !roleRow) return false;

    const { data: userRole, error: userRoleError } = await supabase
      .from('user_roles')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('membership_id', membershipId)
      .eq('role_id', roleRow.id)
      .limit(1);

    if (userRoleError) return false;
    return (userRole ?? []).length > 0;
  };

  return createSupabaseActivityRepository(rpcClient, membershipRoleReader);
}
