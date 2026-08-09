const INTERNAL_STATE_LABELS: Record<string, string> = {
  CREATED: 'تم الإنشاء',
  PLANNING_DRAFT: 'مسودة التخطيط',
  PRE_REVIEW: 'المراجعة الأولية',
  READY_FOR_COMMITTEE: 'جاهز للجنة',
  UNDER_COMMITTEE_REVIEW: 'قيد مراجعة اللجنة',
  RETURNED_FOR_CORRECTION: 'معاد للتصحيح',
  NOT_APPROVED: 'غير موافق عليه داخليًا',
  APPROVED_FOR_SCFHS_SUBMISSION: 'موافق عليه داخليًا للرفع',
  READY_FOR_SCFHS_SUBMISSION: 'جاهز للرفع',
  EXTERNAL_TRACKING: 'متابعة خارجية',
  ACTIVITY_CONDUCTED: 'تم تنفيذ النشاط',
  IMPACT_FOLLOWUP: 'متابعة الأثر',
  FINAL_IMPACT_REPORT: 'تقرير الأثر النهائي',
  ANNUAL_REPORTING: 'ضمن التقرير السنوي',
  ARCHIVED: 'مؤرشف',
};

export function getInternalStateLabel(state: string): string {
  return INTERNAL_STATE_LABELS[state] ?? state;
}
