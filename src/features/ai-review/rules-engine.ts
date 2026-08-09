export type ReviewStatus =
  | 'ALIGNED'
  | 'NEEDS_IMPROVEMENT'
  | 'MISSING_REQUIRED_INFORMATION'
  | 'MISSING_EVIDENCE'
  | 'INCONSISTENT'
  | 'UNREADABLE_UNCERTAIN'
  | 'HUMAN_REVIEW_REQUIRED';

export type FindingSeverity = 'CRITICAL' | 'MAJOR' | 'ADVISORY';

export type ReadinessFinding = {
  ruleCode: string;
  sourceCode: string;
  sourceVersion: string;
  status: ReviewStatus;
  severity: FindingSeverity;
  rationale: string;
  recommendation: string;
  confidence: number;
  evidenceLocation: string;
};

export type PreReviewInput = {
  committeeMemberCount: number;
  learningGap: string;
  objectives: string[];
  learningMethods: string;
  evaluationMethod: string;
  speakerCount: number;
  speakerCvCount: number;
  disclosureStatuses: string[];
};

const weakObjectiveVerbs = [
  'understand',
  'know',
  'believe',
  'appreciate',
  'aware',
  'be aware',
  'familiar',
  'be familiar',
];

const measurableObjectiveVerbs = [
  'apply',
  'demonstrate',
  'perform',
  'identify',
  'analyze',
  'analyse',
  'evaluate',
  'assess',
  'compare',
  'differentiate',
  'construct',
  'create',
  'calculate',
  'select',
  'classify',
  'interpret',
  'use',
  'implement',
  'develop',
  'design',
  'document',
  'recognize',
  'recognise',
];

function normalizedWords(value: string): string[] {
  return value.toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/\s+/).filter(Boolean);
}

export function reviewObjective(objective: string): {
  status: 'ALIGNED' | 'NEEDS_IMPROVEMENT';
  weakVerbs: string[];
  message: string;
} {
  const lower = objective.trim().toLowerCase();
  const words = normalizedWords(objective);
  const weakVerbs = weakObjectiveVerbs.filter((verb) => lower.includes(verb));
  const hasMeasurableVerb = measurableObjectiveVerbs.some((verb) => words.includes(verb));

  if (!objective.trim() || weakVerbs.length > 0 || !hasMeasurableVerb) {
    return {
      status: 'NEEDS_IMPROVEMENT',
      weakVerbs,
      message: 'استخدم فعلًا سلوكيًا قابلًا للملاحظة والقياس، ثم اربط الهدف بطريقة التعليم وطريقة التقييم المناسبة.',
    };
  }

  return {
    status: 'ALIGNED',
    weakVerbs: [],
    message: 'الهدف يستخدم فعلًا قابلًا للملاحظة والقياس. يلزم بقاء المراجعة البشرية للتحقق من السياق والمواءمة الكاملة.',
  };
}

function finding(
  ruleCode: string,
  sourceCode: string,
  sourceVersion: string,
  status: ReviewStatus,
  severity: FindingSeverity,
  rationale: string,
  recommendation: string,
  evidenceLocation: string,
  confidence = 1,
): ReadinessFinding {
  return { ruleCode, sourceCode, sourceVersion, status, severity, rationale, recommendation, confidence, evidenceLocation };
}

export function runDeterministicPreReview(input: PreReviewInput): ReadinessFinding[] {
  const findings: ReadinessFinding[] = [];

  if (input.committeeMemberCount < 2) {
    findings.push(finding(
      'ACT-GOV-001',
      'SCFHS_ACTIVITY_ACCREDITATION_STANDARDS',
      '2023',
      'MISSING_REQUIRED_INFORMATION',
      'CRITICAL',
      'بيانات اللجنة العلمية الخاصة بالنشاط لا تُظهر الحد الأدنى المطلوب من الأعضاء وفق قاعدة النشاط المطبقة.',
      'استكمل بيانات اللجنة العلمية الخاصة بالنشاط. لا تضف أسماء غير موثقة أو تفترض أعضاء غير موجودين.',
      'activity_scientific_committee',
    ));
  }

  if (!input.learningGap.trim()) {
    findings.push(finding(
      'ACT-NEED-001',
      'SCFHS_ACTIVITY_ACCREDITATION_STANDARDS',
      '2023',
      'MISSING_REQUIRED_INFORMATION',
      'MAJOR',
      'لم تُسجل فجوة تعليمية/مهنية قابلة للمراجعة.',
      'أدخل الفجوة الفعلية المدعومة بمصدر الاحتياج. لا تُنشئ خط أساس أو نسبة مستهدفة غير متوفرة.',
      'activity_intake.learning_gap',
    ));
  }

  if (input.objectives.length === 0 || input.objectives.every((objective) => !objective.trim())) {
    findings.push(finding(
      'ACT-OBJ-001',
      'SCFHS_ACTIVITY_ACCREDITATION_STANDARDS',
      '2023',
      'MISSING_REQUIRED_INFORMATION',
      'CRITICAL',
      'لا توجد أهداف تعليمية مسجلة للنشاط.',
      'أدخل أهداف النشاط الفعلية بصياغة قابلة للقياس ثم راجع مواءمتها مع طرق التعليم والتقييم.',
      'activity_learning_objectives',
    ));
  } else {
    input.objectives.forEach((objective, index) => {
      if (!objective.trim()) return;
      const review = reviewObjective(objective);
      if (review.status === 'NEEDS_IMPROVEMENT') {
        findings.push(finding(
          'ACT-OBJ-002',
          'CPD_EDUCATIONAL_GUIDANCE',
          'BLOOM_SMART',
          'NEEDS_IMPROVEMENT',
          'MAJOR',
          `الهدف رقم ${index + 1} يحتاج مراجعة من حيث قابلية القياس والفعل المستخدم.`,
          review.message,
          `activity_learning_objectives[${index}]`,
          0.95,
        ));
      }
    });
  }

  if (!input.learningMethods.trim()) {
    findings.push(finding(
      'ACT-METHOD-001',
      'SCFHS_ACTIVITY_ACCREDITATION_STANDARDS',
      '2023',
      'MISSING_REQUIRED_INFORMATION',
      'MAJOR',
      'لم تُسجل طريقة/طرق التعلم والتنفيذ.',
      'حدد طرق التعلم المستخدمة فعليًا ثم تحقق من ملاءمتها للأهداف المسجلة.',
      'activity_intake.learning_methods',
    ));
  }

  if (!input.evaluationMethod.trim()) {
    findings.push(finding(
      'ACT-EVAL-001',
      'SCFHS_ACTIVITY_ACCREDITATION_STANDARDS',
      '2023',
      'MISSING_REQUIRED_INFORMATION',
      'MAJOR',
      'طريقة تقييم النشاط أو المشاركين غير مسجلة.',
      'سجل طريقة التقييم الفعلية واربطها بالأهداف دون اختراع أداة تقييم غير مستخدمة.',
      'activity_intake.participant_evaluation_method',
    ));
  }

  if (input.speakerCount === 0) {
    findings.push(finding(
      'ACT-SPK-001',
      'SCFHS_ACTIVITY_ACCREDITATION_STANDARDS',
      '2023',
      'MISSING_REQUIRED_INFORMATION',
      'MAJOR',
      'لا توجد بيانات متحدثين/مدربين مرتبطة بالنشاط.',
      'أدخل المتحدثين أو المدربين الفعليين للنشاط مع بياناتهم المهنية المطلوبة.',
      'activity_speakers',
    ));
  } else if (input.speakerCvCount < input.speakerCount) {
    findings.push(finding(
      'ACT-SPK-002',
      'SCFHS_ACTIVITY_ACCREDITATION_STANDARDS',
      '2023',
      'MISSING_EVIDENCE',
      'MAJOR',
      'عدد السير الذاتية المتاحة أقل من عدد المتحدثين المسجلين.',
      'اربط لكل متحدث السيرة الذاتية المتاحة أو وثّق مراجعتها خارج المنصة وفق مسار الأدلة المعتمد.',
      'speaker_documents',
    ));
  }

  if (input.disclosureStatuses.length === 0) {
    findings.push(finding(
      'ACT-COI-001',
      'SCFHS_ACTIVITY_ACCREDITATION_STANDARDS',
      '2023',
      'MISSING_EVIDENCE',
      'CRITICAL',
      'لا توجد سجلات إفصاح مرتبطة بالأشخاص المشاركين في المحتوى العلمي.',
      'استكمل سجل الإفصاح أو وثّق المراجعة خارج المنصة. لا تفترض عدم وجود تضارب مصالح من غياب المستند.',
      'disclosure_records',
    ));
  } else if (input.disclosureStatuses.some((status) => status === 'PENDING')) {
    findings.push(finding(
      'ACT-COI-002',
      'SCFHS_ACTIVITY_ACCREDITATION_STANDARDS',
      '2023',
      'HUMAN_REVIEW_REQUIRED',
      'CRITICAL',
      'توجد إفصاحات ما تزال بحالة Pending.',
      'أكمل التحقق البشري من الإفصاحات قبل قرار اللجنة المؤسسية.',
      'disclosure_records',
    ));
  }

  if (findings.length === 0) {
    findings.push(finding(
      'ACT-READINESS-SUMMARY',
      'INTERNAL_READINESS_ENGINE',
      '1.0',
      'ALIGNED',
      'ADVISORY',
      'لم تكشف القواعد الحتمية الحالية عن نقص مباشر في البيانات التي تغطيها هذه المراجعة.',
      'انتقل إلى المراجعة البشرية واللجنة المؤسسية؛ هذه النتيجة ليست اعتمادًا ولا قرار امتثال صادرًا عن الهيئة.',
      'activity_record',
    ));
  }

  return findings;
}

const piiKeyPattern = /(email|e-mail|mobile|phone|national.?id|identity|signature|contact|passport|iqama)/i;

export function sanitizeAiPayload<T extends Record<string, unknown>>(payload: T): T {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (piiKeyPattern.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        item && typeof item === 'object' && !Array.isArray(item)
          ? sanitizeAiPayload(item as Record<string, unknown>)
          : item,
      );
    } else if (value && typeof value === 'object') {
      sanitized[key] = sanitizeAiPayload(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized as T;
}
