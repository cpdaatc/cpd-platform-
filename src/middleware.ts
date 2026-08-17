import { NextResponse, type NextRequest } from 'next/server';
import { GOVERNANCE_ROLES, roleHasPermission, type GovernanceRole, type Permission } from '@/lib/auth/permissions';

const ROLE_COOKIE='cpd_role_context';
const ROUTE_RULES:{matches:(path:string)=>boolean;anyOf:Permission[]}[]=[
  {matches:path=>path==='/platform'||path.startsWith('/platform/'),anyOf:['platform.manage']},
  {matches:path=>path==='/admin/users'||path.startsWith('/admin/users/'),anyOf:['organization.users.manage']},
  {matches:path=>path==='/admin/committee'||path.startsWith('/admin/committee/'),anyOf:['committee.manage_structure']},
  {matches:path=>path==='/admin/references'||path.startsWith('/admin/references/'),anyOf:['ai.manage_references']},
  {matches:path=>path==='/admin/ai-settings'||path.startsWith('/admin/ai-settings/'),anyOf:['ai.settings.configure','ai.settings.approve']},
  {matches:path=>path==='/admin/templates'||path.startsWith('/admin/templates/'),anyOf:['template.manage','template.approve']},
  {matches:path=>path==='/admin'||path.startsWith('/admin/activities/'),anyOf:['activity.create']},
  {matches:path=>path==='/committee/secretary'||path.startsWith('/committee/secretary/'),anyOf:['committee.prepare']},
  {matches:path=>path==='/committee/chair'||path.startsWith('/committee/chair/'),anyOf:['activity.final_decision']},
  {matches:path=>path==='/committee/member'||path.startsWith('/committee/member/'),anyOf:['committee.comment']},
  {matches:path=>path==='/external'||path.startsWith('/external/'),anyOf:['external.view']},
  {matches:path=>path==='/impact'||path.startsWith('/impact/'),anyOf:['impact.view']},
  {matches:path=>path==='/annual-reports'||path.startsWith('/annual-reports/'),anyOf:['annual.view']},
  {matches:path=>path==='/reports'||path.startsWith('/reports/'),anyOf:['report.view']},
  {matches:path=>path==='/evidence'||path.startsWith('/evidence/'),anyOf:['evidence.readiness.view']},
  {matches:path=>path==='/notifications'||path.startsWith('/notifications/'),anyOf:['notification.view']},
  {matches:path=>path==='/audit'||path.startsWith('/audit/'),anyOf:['audit.view']},
];

export function isRouteAllowedForRole(pathname:string,role:GovernanceRole){
  const rule=ROUTE_RULES.find(item=>item.matches(pathname));
  return !rule||rule.anyOf.some(permission=>roleHasPermission(role,permission));
}

export function middleware(request:NextRequest){
  const value=request.cookies.get(ROLE_COOKIE)?.value;
  if(!value||(GOVERNANCE_ROLES as readonly string[]).includes(value)===false)return NextResponse.next();
  if(isRouteAllowedForRole(request.nextUrl.pathname,value as GovernanceRole))return NextResponse.next();
  const target=request.nextUrl.clone(); target.pathname='/access-denied'; target.search='';
  return NextResponse.redirect(target);
}

export const config={matcher:['/platform/:path*','/admin/:path*','/committee/:path*','/external/:path*','/impact/:path*','/annual-reports/:path*','/reports/:path*','/evidence/:path*','/notifications/:path*','/audit/:path*']};
