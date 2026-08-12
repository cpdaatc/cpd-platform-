import type { GovernanceRole } from './permissions';

export type RoleGuidance = {
  missionAr: string;
  missionEn: string;
  startHref: string;
  startAr: string;
  startEn: string;
  responsibilitiesAr: readonly string[];
  responsibilitiesEn: readonly string[];
  boundaryAr: string;
  boundaryEn: string;
};

export const ROLE_GUIDANCE: Record<GovernanceRole, RoleGuidance> = {
  PLATFORM_SUPER_ADMIN: {
    missionAr: 'إدارة نطاق المنصة وعزل المؤسسات دون امتلاك صلاحيات تشغيلية أو علمية ضمن المؤسسة تلقائيًا.',
    missionEn: 'Govern the platform scope and tenant isolation without implicit organizational or scientific authority.',
    startHref: '/platform', startAr: 'فتح حوكمة المنصة', startEn: 'Open platform governance',
    responsibilitiesAr: ['مراجعة نطاق المؤسسات المتاح', 'التحقق من حدود عزل المستأجرين'],
    responsibilitiesEn: ['Review the visible organization scope', 'Verify tenant-isolation boundaries'],
    boundaryAr: 'لا ينشئ الأنشطة ولا يتخذ قرارات اللجنة ولا يطّلع على بيانات المؤسسة دون عضوية وصلاحية مستقلة.',
    boundaryEn: 'Cannot create activities, make committee decisions, or access tenant data without separate membership and permission.',
  },
  ORGANIZATION_SYSTEM_ADMIN: {
    missionAr: 'تهيئة المؤسسة والمستخدمين والأنشطة وإسناد المسؤوليات وتجهيز البنية التشغيلية.',
    missionEn: 'Configure the organization, users, activities, assignments and operational foundations.',
    startHref: '/admin', startAr: 'إدارة الأنشطة', startEn: 'Manage activities',
    responsibilitiesAr: ['إنشاء النشاط وإسناده', 'إدارة المستخدمين واللجنة والمراجع والقوالب', 'تهيئة سياسات الأثر وAI'],
    responsibilitiesEn: ['Create and assign activities', 'Manage users, committee, references and templates', 'Configure impact and AI policies'],
    boundaryAr: 'لا يملك القرار العلمي النهائي ولا اعتماد الخصوصية أو المنهجية نيابةً عن الإدارة.',
    boundaryEn: 'Cannot make the final scientific decision or approve privacy/methodology on management’s behalf.',
  },
  ACTIVITY_OFFICER: {
    missionAr: 'إكمال ملف النشاط المسند، معالجة فجوات الجاهزية، ثم متابعة الرفع والأثر.',
    missionEn: 'Complete assigned activity files, resolve readiness gaps, then track submission and impact.',
    startHref: '/activities', startAr: 'فتح أنشطتي', startEn: 'Open my activities',
    responsibilitiesAr: ['تعبئة ملف النشاط والأدلة', 'تشغيل الفحص القبلي ورفع النسخة للجنة', 'تسجيل التتبع الخارجي وقياسات الأثر'],
    responsibilitiesEn: ['Complete the activity file and evidence', 'Run pre-review and submit a revision', 'Record external tracking and impact measurements'],
    boundaryAr: 'لا ينشئ النشاط ولا يعتمد قرار اللجنة ولا يقر منهجية الأثر.',
    boundaryEn: 'Cannot create the activity, approve committee decisions, or approve impact methodology.',
  },
  COMMITTEE_SECRETARY: {
    missionAr: 'تنظيم دورة اللجنة وتوثيق الحضور والنتيجة الجماعية والمحاضر دون اتخاذ القرار النهائي.',
    missionEn: 'Run the committee cycle and document attendance, collective results and minutes without final decision authority.',
    startHref: '/committee/secretary', startAr: 'فتح مساحة اللجنة', startEn: 'Open committee workspace',
    responsibilitiesAr: ['إعداد الاجتماعات والمراجعات', 'توثيق التقييم الجماعي', 'إعداد مسودة المحضر والتقرير السنوي'],
    responsibilitiesEn: ['Prepare meetings and reviews', 'Record the collective assessment', 'Draft minutes and annual reporting'],
    boundaryAr: 'لا يتخذ قرار الموافقة النهائي ولا يعتمد المحضر النهائي.',
    boundaryEn: 'Cannot issue the final approval decision or finalize minutes.',
  },
  COMMITTEE_CHAIR: {
    missionAr: 'حسم القرار العلمي الداخلي، توثيق الملاحظات، واعتماد المحاضر والتقرير السنوي للجنة.',
    missionEn: 'Make the internal scientific decision, document comments, and approve minutes and the annual report.',
    startHref: '/committee/chair', startAr: 'فتح قائمة القرارات', startEn: 'Open decision queue',
    responsibilitiesAr: ['مراجعة نتيجة اللجنة والأدلة', 'اتخاذ قرار الرفع أو الإعادة أو عدم الموافقة', 'اعتماد المحضر والتقرير السنوي'],
    responsibilitiesEn: ['Review committee results and evidence', 'Approve for submission, return, or decline', 'Finalize minutes and approve the annual report'],
    boundaryAr: 'القرار داخلي لجاهزية الرفع ولا يمثل اعتماد الجهة الخارجية.',
    boundaryEn: 'The decision is internal submission readiness, not external accreditation.',
  },
  COMMITTEE_MEMBER: {
    missionAr: 'المراجعة العلمية وإضافة ملاحظات موثقة ضمن العمل الجماعي للجنة.',
    missionEn: 'Perform scientific review and add evidence-based comments within the collective committee process.',
    startHref: '/committee/member', startAr: 'فتح المراجعات', startEn: 'Open reviews',
    responsibilitiesAr: ['مراجعة النسخة المقدمة', 'إضافة الملاحظات العلمية', 'التحقق المخول من الأدلة غير الرقمية'],
    responsibilitiesEn: ['Review submitted revisions', 'Add scientific comments', 'Perform authorized offline-evidence verification'],
    boundaryAr: 'لا يسجل النتيجة الجماعية ولا يصدر القرار النهائي منفردًا.',
    boundaryEn: 'Cannot record the collective result or issue the final decision alone.',
  },
  MANAGEMENT_VIEWER: {
    missionAr: 'متابعة الأداء والاعتماد الخارجي والأثر والتقارير بصلاحية قراءة فقط.',
    missionEn: 'Monitor performance, external status, impact and reports with read-only authority.',
    startHref: '/impact', startAr: 'فتح لوحة الأثر', startEn: 'Open impact dashboard',
    responsibilitiesAr: ['متابعة الحالات الخارجية', 'قراءة مؤشرات الأثر وHTVI', 'عرض التقارير والأدلة'],
    responsibilitiesEn: ['Monitor external statuses', 'Read impact and HTVI indicators', 'View reports and evidence'],
    boundaryAr: 'لا يعدل السجلات ولا يعتمد القرارات أو المنهجيات.',
    boundaryEn: 'Cannot modify records or approve decisions and methodologies.',
  },
  MANAGEMENT_APPROVER: {
    missionAr: 'تنفيذ نقاط الاعتماد الإداري المنفصلة مع المحافظة على فصل المهام.',
    missionEn: 'Execute independent management approval points while preserving separation of duties.',
    startHref: '/dashboard', startAr: 'مراجعة مهام الاعتماد', startEn: 'Review approval tasks',
    responsibilitiesAr: ['اعتماد منهجية الأثر', 'اعتماد الخصوصية لمزوّد AI', 'تفعيل القوالب وإقرار التقرير السنوي وطلبات التصحيح'],
    responsibilitiesEn: ['Approve impact methodology', 'Approve external-AI privacy', 'Activate templates and acknowledge annual reports/corrections'],
    boundaryAr: 'لا يكوّن الإعدادات التي يعتمدها ولا يتخذ القرار العلمي للجنة.',
    boundaryEn: 'Cannot configure what it approves or make the committee’s scientific decision.',
  },
  AUDITOR: {
    missionAr: 'فحص سلامة الأثر التدقيقي والتقارير والأدلة دون تعديل البيانات التشغيلية.',
    missionEn: 'Inspect the audit trail, reports and evidence without modifying operational data.',
    startHref: '/audit', startAr: 'فتح سجل التدقيق', startEn: 'Open audit trail',
    responsibilitiesAr: ['مراجعة الأحداث وتسلسلها', 'تتبع الدور والكيان لكل إجراء', 'مطابقة التقارير مع الأدلة'],
    responsibilitiesEn: ['Review events and sequence', 'Trace role and entity for every action', 'Reconcile reports with evidence'],
    boundaryAr: 'صلاحية قراءة فقط؛ سجل التدقيق غير قابل للتعديل أو الحذف.',
    boundaryEn: 'Read-only authority; the audit trail is immutable.',
  },
};

export const WORKFLOW_STAGES = [
  { number: '01', ar: 'التأسيس والإسناد', en: 'Setup & assignment', descAr: 'تهيئة المؤسسة وإنشاء النشاط وإسناده.', descEn: 'Configure the organization, create and assign the activity.' },
  { number: '02', ar: 'الإعداد والجاهزية', en: 'Preparation & readiness', descAr: 'اكتمال الملف والأدلة والفحص القبلي.', descEn: 'Complete the file, evidence and pre-review.' },
  { number: '03', ar: 'مراجعة اللجنة', en: 'Committee review', descAr: 'تقييم جماعي ثم قرار الرئيس الداخلي.', descEn: 'Collective assessment followed by the Chair decision.' },
  { number: '04', ar: 'الرفع والتنفيذ', en: 'Submission & delivery', descAr: 'تتبع مستقل للحالة الخارجية والتنفيذ.', descEn: 'Independently track external status and delivery.' },
  { number: '05', ar: 'الأثر والتقارير', en: 'Impact & reporting', descAr: 'L1–L4 وHTVI والتقرير السنوي والتدقيق.', descEn: 'L1–L4, HTVI, annual reporting and audit.' },
] as const;
