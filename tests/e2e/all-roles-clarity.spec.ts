import { expect, test, type Page } from '@playwright/test';

const password='E2E-Only-Strong-Password-2026!';

async function login(page:Page,email:string,role?:string){
  await page.goto('/login');
  await page.getByLabel(/البريد الإلكتروني|Email address/).fill(email);
  await page.getByLabel(/كلمة المرور|Password/).fill(password);
  await page.getByRole('button',{name:/تسجيل الدخول|Sign in/}).click();
  if(role){await expect(page).toHaveURL(/\/context/);await page.getByRole('button',{name:new RegExp(role)}).click()}
  await expect(page).toHaveURL(/\/dashboard/);
}

async function expectActiveNav(page:Page,name:string){
  const navigation=page.getByRole('navigation',{name:'التنقل الرئيسي حسب الدور'});
  await expect(navigation.getByRole('link',{name:new RegExp(name)})).toHaveAttribute('aria-current','page');
}

test('Platform Super Admin has an explicit platform boundary and no tenant operations',async({page})=>{
  await login(page,'e2e.platform@example.test');
  await expect(page.getByRole('heading',{name:'مسؤول المنصة العام'})).toBeVisible();
  await page.getByRole('navigation',{name:'التنقل الرئيسي حسب الدور'}).getByRole('link',{name:/حوكمة المنصة/}).click();
  await expect(page.getByRole('heading',{name:'حوكمة نطاق المنصة'})).toBeVisible();
  await expectActiveNav(page,'حوكمة المنصة');
  await expect(page.getByRole('link',{name:/إدارة الأنشطة/})).toHaveCount(0);
});

test('Organization System Admin sees complete administration and no scientific decision queue',async({page})=>{
  await login(page,'e2e.admin.secretary@example.test','ORGANIZATION_SYSTEM_ADMIN');
  const navigation=page.getByRole('navigation',{name:'التنقل الرئيسي حسب الدور'});
  for(const name of ['إدارة الأنشطة','المستخدمون والأدوار','تشكيل اللجنة','المراجع والقواعد','خصوصية AI الخارجي','القوالب والإصدارات','سجل التدقيق']) await expect(navigation.getByRole('link',{name:new RegExp(name)})).toBeVisible();
  await expect(navigation.getByRole('link',{name:/قرارات رئيس اللجنة/})).toHaveCount(0);
  await navigation.getByRole('link',{name:/المستخدمون والأدوار/}).click();
  await expect(page.getByRole('heading',{name:'المستخدمون والأدوار'})).toBeVisible();
  await expect(page.getByRole('navigation',{name:'إدارة النظام'}).getByRole('link',{name:'المستخدمون والأدوار'})).toHaveAttribute('aria-current','page');
});

test('Activity Officer follows the assigned-activity path without administration authority',async({page})=>{
  await login(page,'e2e.officer@example.test');
  await expect(page.getByRole('heading',{name:'مسؤول النشاط'})).toBeVisible();
  const navigation=page.getByRole('navigation',{name:'التنقل الرئيسي حسب الدور'});
  for(const name of ['أنشطتي','التتبع الخارجي','قياس الأثر وHTVI','جاهزية الأدلة']) await expect(navigation.getByRole('link',{name:new RegExp(name)})).toBeVisible();
  await expect(navigation.getByRole('link',{name:/المستخدمون والأدوار|سجل التدقيق/})).toHaveCount(0);
  await navigation.getByRole('link',{name:/أنشطتي/}).click();
  await expect(page.getByRole('heading',{name:'أنشطتي'})).toBeVisible();
  await expectActiveNav(page,'أنشطتي');
});

test('Committee Secretary sees preparation and reporting but not Chair decisions',async({page})=>{
  await login(page,'e2e.admin.secretary@example.test','COMMITTEE_SECRETARY');
  const navigation=page.getByRole('navigation',{name:'التنقل الرئيسي حسب الدور'});
  await expect(navigation.getByRole('link',{name:/مساحة سكرتير اللجنة/})).toBeVisible();
  await expect(navigation.getByRole('link',{name:/التقرير السنوي/})).toBeVisible();
  await expect(navigation.getByRole('link',{name:/قرارات رئيس اللجنة|إدارة الأنشطة/})).toHaveCount(0);
  await navigation.getByRole('link',{name:/مساحة سكرتير اللجنة/}).click();
  await expect(page.getByRole('heading',{name:'مساحة عمل سكرتير اللجنة'})).toBeVisible();
});

test('Committee Chair sees the internal decision queue and its explicit boundary',async({page})=>{
  await login(page,'e2e.chair@example.test');
  await expect(page.getByText('القرار داخلي لجاهزية الرفع ولا يمثل اعتماد الجهة الخارجية.').first()).toBeVisible();
  await page.getByRole('navigation',{name:'التنقل الرئيسي حسب الدور'}).getByRole('link',{name:/قرارات رئيس اللجنة/}).click();
  await expect(page.getByRole('heading',{name:'قرارات رئيس اللجنة'})).toBeVisible();
  await expectActiveNav(page,'قرارات رئيس اللجنة');
});

test('Committee Member sees scientific reviews without collective or final decision workspaces',async({page})=>{
  await login(page,'e2e.member@example.test');
  const navigation=page.getByRole('navigation',{name:'التنقل الرئيسي حسب الدور'});
  await expect(navigation.getByRole('link',{name:/مراجعات عضو اللجنة/})).toBeVisible();
  await expect(navigation.getByRole('link',{name:/مساحة سكرتير اللجنة|قرارات رئيس اللجنة|التقارير والطباعة/})).toHaveCount(0);
  await navigation.getByRole('link',{name:/مراجعات عضو اللجنة/}).click();
  await expect(page.getByRole('heading',{name:'مراجعات اللجنة العلمية المؤسسية'})).toBeVisible();
});

test('Management Viewer remains read-only across monitoring outputs',async({page})=>{
  await login(page,'e2e.viewer@example.test');
  const navigation=page.getByRole('navigation',{name:'التنقل الرئيسي حسب الدور'});
  for(const name of ['التتبع الخارجي','قياس الأثر وHTVI','التقرير السنوي','التقارير والطباعة','جاهزية الأدلة']) await expect(navigation.getByRole('link',{name:new RegExp(name)})).toBeVisible();
  await expect(navigation.getByRole('link',{name:/خصوصية AI الخارجي|القوالب والإصدارات|إدارة الأنشطة/})).toHaveCount(0);
});

test('Management Approver sees only governed approval workspaces',async({page})=>{
  await login(page,'e2e.management@example.test');
  const navigation=page.getByRole('navigation',{name:'التنقل الرئيسي حسب الدور'});
  await expect(navigation.getByRole('link',{name:/خصوصية AI الخارجي/})).toBeVisible();
  await expect(navigation.getByRole('link',{name:/القوالب والإصدارات/})).toBeVisible();
  await expect(navigation.getByRole('link',{name:/المراجع والقواعد|المستخدمون والأدوار/})).toHaveCount(0);
  await navigation.getByRole('link',{name:/خصوصية AI الخارجي/}).click();
  await expect(page.getByRole('heading',{name:'إعدادات الخصوصية ومزوّد AI الخارجي'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'تكوين المزوّد'})).toHaveCount(0);
});

test('Auditor can inspect immutable events and has no mutation workspaces',async({page})=>{
  await login(page,'e2e.auditor@example.test');
  const navigation=page.getByRole('navigation',{name:'التنقل الرئيسي حسب الدور'});
  await navigation.getByRole('link',{name:/سجل التدقيق/}).click();
  await expect(page.getByRole('heading',{name:'سجل التدقيق'})).toBeVisible();
  await expect(page.getByText('uat.fixture_created')).toBeVisible();
  await expect(page.getByText('ORGANIZATION_SYSTEM_ADMIN').first()).toBeVisible();
  await expectActiveNav(page,'سجل التدقيق');
  await expect(navigation.getByRole('link',{name:/إدارة الأنشطة|أنشطتي|القوالب والإصدارات/})).toHaveCount(0);
});

const routeMatrix=[
  {name:'Platform Super Admin',email:'e2e.platform@example.test',paths:['/platform']},
  {name:'Organization System Admin',email:'e2e.admin.secretary@example.test',role:'ORGANIZATION_SYSTEM_ADMIN',paths:['/admin','/admin/users','/admin/committee','/admin/references','/admin/ai-settings','/admin/templates','/external','/impact','/annual-reports','/reports','/evidence','/notifications','/audit']},
  {name:'Activity Officer',email:'e2e.officer@example.test',paths:['/activities','/external','/impact','/evidence','/notifications']},
  {name:'Committee Secretary',email:'e2e.admin.secretary@example.test',role:'COMMITTEE_SECRETARY',paths:['/committee/secretary','/external','/impact','/annual-reports','/reports','/evidence','/notifications']},
  {name:'Committee Chair',email:'e2e.chair@example.test',paths:['/committee/chair','/external','/impact','/annual-reports','/reports','/evidence','/notifications']},
  {name:'Committee Member',email:'e2e.member@example.test',paths:['/committee/member','/notifications']},
  {name:'Management Viewer',email:'e2e.viewer@example.test',paths:['/external','/impact','/annual-reports','/reports','/evidence','/notifications']},
  {name:'Management Approver',email:'e2e.management@example.test',paths:['/external','/impact','/annual-reports','/reports','/evidence','/notifications','/admin/templates','/admin/ai-settings']},
  {name:'Auditor',email:'e2e.auditor@example.test',paths:['/external','/impact','/annual-reports','/reports','/evidence','/notifications','/audit']},
] as const;

for(const scenario of routeMatrix){
  test(`${scenario.name} can open every authorized top-level workspace without a dead end`,async({page})=>{
    await login(page,scenario.email,'role' in scenario?scenario.role:undefined);
    for(const path of scenario.paths){
      await page.goto(path);
      await expect(page.getByRole('heading',{name:'تعذر فتح هذا القسم'}),`Unexpected role or data error at ${path}`).toHaveCount(0);
      await expect(page.locator('main')).toBeVisible();
    }
  });
}

test('direct navigation outside the active role is stopped with a clear recovery path',async({page})=>{
  await login(page,'e2e.officer@example.test');
  await page.goto('/admin/users');
  await expect(page.getByRole('heading',{name:'هذا القسم غير متاح للدور الحالي'})).toBeVisible();
  await expect(page.getByRole('link',{name:'العودة إلى لوحة دوري'})).toBeVisible();
});
