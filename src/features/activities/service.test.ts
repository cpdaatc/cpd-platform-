import { describe, expect, it } from 'vitest';
import type { GovernanceRole } from '@/lib/auth/permissions';
import {
  ActivityAuthorizationError,
  ActivityValidationError,
  assignActivityOfficer,
  createActivity,
  type ActivityActionContext,
  type ActivityRepository,
  type AuditWriter,
  type CreatedActivity,
} from './service';

function context(activeRole: GovernanceRole): ActivityActionContext {
  return {
    userId: 'user-admin',
    organizationId: 'org-a',
    membershipId: 'membership-admin',
    assignedRoles: ['ORGANIZATION_SYSTEM_ADMIN', 'COMMITTEE_SECRETARY'],
    activeRole,
  };
}

class InMemoryActivities implements ActivityRepository {
  public activities: CreatedActivity[] = [];
  public assignments: Array<{ activityId: string; membershipId: string }> = [];
  public officerMemberships = new Set(['officer-a']);

  async createActivity(input: Parameters<ActivityRepository['createActivity']>[0]) {
    const activity: CreatedActivity = {
      id: `activity-${this.activities.length + 1}`,
      activityCode: `CPD-${input.reportingYear}-${String(this.activities.length + 1).padStart(3, '0')}`,
      organizationId: input.organizationId,
      titleAr: input.titleAr,
      titleEn: input.titleEn ?? null,
      reportingYear: input.reportingYear,
      internalState: 'CREATED',
    };
    this.activities.push(activity);
    return activity;
  }

  async membershipHasRole(organizationId: string, membershipId: string, role: GovernanceRole) {
    return organizationId === 'org-a' && role === 'ACTIVITY_OFFICER' && this.officerMemberships.has(membershipId);
  }

  async assignActivityOfficer(input: Parameters<ActivityRepository['assignActivityOfficer']>[0]) {
    const belongs = this.activities.some(
      (activity) => activity.id === input.activityId && activity.organizationId === input.organizationId,
    );
    if (!belongs) return false;
    this.assignments.push({ activityId: input.activityId, membershipId: input.membershipId });
    return true;
  }
}

class InMemoryAudit implements AuditWriter {
  public events: Parameters<AuditWriter['write']>[0][] = [];
  async write(event: Parameters<AuditWriter['write']>[0]) {
    this.events.push(event);
  }
}

describe('governed activity actions', () => {
  it('allows System Admin to create an activity and records the active role context', async () => {
    const repository = new InMemoryActivities();
    const audit = new InMemoryAudit();

    const activity = await createActivity(
      { titleAr: 'ورشة تحسين الجودة', reportingYear: 2026 },
      context('ORGANIZATION_SYSTEM_ADMIN'),
      { repository, audit },
    );

    expect(activity.activityCode).toBe('CPD-2026-001');
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]).toMatchObject({
      action: 'activity.created',
      organizationId: 'org-a',
      userId: 'user-admin',
      roleContext: 'ORGANIZATION_SYSTEM_ADMIN',
      entityId: activity.id,
    });
  });

  it('does not merge Admin permission into Secretary role context', async () => {
    const repository = new InMemoryActivities();
    const audit = new InMemoryAudit();

    await expect(
      createActivity(
        { titleAr: 'نشاط', reportingYear: 2026 },
        context('COMMITTEE_SECRETARY'),
        { repository, audit },
      ),
    ).rejects.toBeInstanceOf(ActivityAuthorizationError);
  });

  it('rejects invalid activity input before repository access', async () => {
    const repository = new InMemoryActivities();
    const audit = new InMemoryAudit();

    await expect(
      createActivity(
        { titleAr: '', reportingYear: 1900 },
        context('ORGANIZATION_SYSTEM_ADMIN'),
        { repository, audit },
      ),
    ).rejects.toBeInstanceOf(ActivityValidationError);
    expect(repository.activities).toHaveLength(0);
  });

  it('assigns only a membership that has the Activity Officer role in the same organization', async () => {
    const repository = new InMemoryActivities();
    const audit = new InMemoryAudit();
    const admin = context('ORGANIZATION_SYSTEM_ADMIN');
    const activity = await createActivity(
      { titleAr: 'نشاط قابل للإسناد', reportingYear: 2026 },
      admin,
      { repository, audit },
    );

    await assignActivityOfficer(activity.id, 'officer-a', admin, { repository, audit });
    expect(repository.assignments).toEqual([{ activityId: activity.id, membershipId: 'officer-a' }]);

    await expect(
      assignActivityOfficer(activity.id, 'foreign-or-non-officer', admin, { repository, audit }),
    ).rejects.toBeInstanceOf(ActivityAuthorizationError);
  });
});
