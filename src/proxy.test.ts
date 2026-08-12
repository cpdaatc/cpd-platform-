import {describe,expect,it} from 'vitest';
import {isRouteAllowedForRole} from './proxy';

describe('role-context route clarity guard',()=>{
  it('sends users only to top-level workspaces visible to the active role',()=>{
    expect(isRouteAllowedForRole('/admin/users','ORGANIZATION_SYSTEM_ADMIN')).toBe(true);
    expect(isRouteAllowedForRole('/admin/users','ACTIVITY_OFFICER')).toBe(false);
    expect(isRouteAllowedForRole('/admin/ai-settings','MANAGEMENT_APPROVER')).toBe(true);
    expect(isRouteAllowedForRole('/admin/references','MANAGEMENT_APPROVER')).toBe(false);
    expect(isRouteAllowedForRole('/committee/chair','COMMITTEE_SECRETARY')).toBe(false);
    expect(isRouteAllowedForRole('/audit','AUDITOR')).toBe(true);
  });
});
