import { describe, expect, it } from 'vitest';
import type { GovernanceRole } from '@/lib/auth/permissions';
import {
  ActivityPersistenceError,
  createSupabaseActivityRepository,
  type ActivityRpcClient,
} from './supabase-repository';

function clientWithRpc(
  handler: ActivityRpcClient['rpc'],
): ActivityRpcClient {
  return { rpc: handler };
}

describe('Supabase activity repository', () => {
  it('maps create_activity_command output to the domain model', async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const client = clientWithRpc(async (fn, args) => {
      calls.push({ fn, args });
      return {
        data: [
          {
            id: 'activity-1',
            activity_code: 'CPD-2026-001',
            organization_id: 'org-a',
            title_ar: 'نشاط تجريبي',
            title_en: null,
            reporting_year: 2026,
            internal_state: 'CREATED',
          },
        ],
        error: null,
      };
    });

    const repository = createSupabaseActivityRepository(client, async () => true);
    const result = await repository.createActivity({
      organizationId: 'org-a',
      actorUserId: 'user-a',
      roleContext: 'ORGANIZATION_SYSTEM_ADMIN',
      titleAr: 'نشاط تجريبي',
      reportingYear: 2026,
    });

    expect(result).toEqual({
      id: 'activity-1',
      activityCode: 'CPD-2026-001',
      organizationId: 'org-a',
      titleAr: 'نشاط تجريبي',
      titleEn: null,
      reportingYear: 2026,
      internalState: 'CREATED',
    });
    expect(calls[0]?.fn).toBe('create_activity_command');
    expect(calls[0]?.args.p_role_context).toBe('ORGANIZATION_SYSTEM_ADMIN');
  });

  it('delegates membership-role verification to the authorized reader', async () => {
    const checks: Array<[string, string, GovernanceRole]> = [];
    const repository = createSupabaseActivityRepository(
      clientWithRpc(async () => ({ data: null, error: null })),
      async (organizationId, membershipId, role) => {
        checks.push([organizationId, membershipId, role]);
        return true;
      },
    );

    await expect(
      repository.membershipHasRole('org-a', 'membership-a', 'ACTIVITY_OFFICER'),
    ).resolves.toBe(true);
    expect(checks).toEqual([['org-a', 'membership-a', 'ACTIVITY_OFFICER']]);
  });

  it('returns false for an authorization rejection from assign command', async () => {
    const repository = createSupabaseActivityRepository(
      clientWithRpc(async (fn) => {
        if (fn === 'assign_activity_officer_command') {
          return { data: null, error: { code: '42501', message: 'not authorized' } };
        }
        return { data: null, error: null };
      }),
      async () => true,
    );

    await expect(
      repository.assignActivityOfficer({
        organizationId: 'org-a',
        activityId: 'activity-foreign',
        membershipId: 'officer-a',
        actorUserId: 'user-a',
        roleContext: 'ORGANIZATION_SYSTEM_ADMIN',
      }),
    ).resolves.toBe(false);
  });

  it('fails closed when the command returns malformed data', async () => {
    const repository = createSupabaseActivityRepository(
      clientWithRpc(async () => ({ data: [], error: null })),
      async () => true,
    );

    await expect(
      repository.createActivity({
        organizationId: 'org-a',
        actorUserId: 'user-a',
        roleContext: 'ORGANIZATION_SYSTEM_ADMIN',
        titleAr: 'نشاط',
        reportingYear: 2026,
      }),
    ).rejects.toBeInstanceOf(ActivityPersistenceError);
  });
});
