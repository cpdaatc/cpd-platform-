'use client';

import { useActionState, useMemo, useState } from 'react';
import {
  saveActivityIntakeAction,
  uploadCompletedPdfAction,
  type IntakeActionState,
} from '@/app/(app)/activities/[id]/intake/actions';

const initialActionState: IntakeActionState = { error: null };
const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 shadow-sm focus:border-teal-700';
const textareaClass = `${inputClass} min-h-28 leading-7`;

type GenericRow = Record<string, unknown>;

type Objective = { objectiveText: string; learningDomain: string; sortOrder: number };
type CommitteeMember = { fullName: string; classificationNumber: string; specialty: string; institution: string; committeeRole: string; sortOrder: number };
type Speaker = { clientKey: string; fullName: string; specialty: string; grade: string; institution: string; relatedExperiencePastThreeYears: string; qualificationsSummary: string; specialCertificatesSummary: string; internationalPresentationsCount: number | null; sortOrder: number };
type Session = { dayLabel: string; topicName: string; startsAt: string; endsAt: string; sortOrder: number; speakerKeys: string[] };
type Disclosure = { personName: string; personRole: string; declarationStatus: 'PENDING' | 'DECLARED_NO_CONFLICT' | 'DECLARED_CONFLICT'; commercialRelationshipSummary: string };

function s(row: GenericRow | null | undefined, key: string): string {
  const value = row?.[key];
  return value == null ? '' : String(value);
}
function b(row: GenericRow | null | undefined, key: string): boolean {
  return row?.[key] === true;
}
function newKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function IntakeWorkspaceForm(props: {
  activity: { id: string; titleAr: string; titleEn: string | null; activityType: string | null; deliveryMethod: string | null };
  profile: GenericRow | null;
  needsAssessmentTools: GenericRow[];
  objectives: GenericRow[];
  committeeMembers: GenericRow[];
  speakers: GenericRow[];
  sessions: GenericRow[];
  disclosures: GenericRow[];
}) {
  const [saveState, saveAction, savePending] = useActionState(saveActivityIntakeAction, initialActionState);
  const [uploadState, uploadAction, uploadPending] = useActionState(uploadCompletedPdfAction, initialActionState);

  const [intakeRoute, setIntakeRoute] = useState<'DIGITAL' | 'PDF' | 'HYBRID'>((s(props.profile, 'intake_route') as 'DIGITAL' | 'PDF' | 'HYBRID') || 'DIGITAL');
  const [specialty, setSpecialty] = useState(s(props.profile, 'specialty'));
  const [languages, setLanguages] = useState<string[]>(Array.isArray(props.profile?.activity_languages) ? (props.profile?.activity_languages as string[]) : []);
  const [collaboration, setCollaboration] = useState<boolean | null>(props.profile?.collaboration == null ? null : b(props.profile, 'collaboration'));
  const [collaboratorName, setCollaboratorName] = useState(s(props.profile, 'collaborator_organization_name'));
  const [collaboratorType, setCollaboratorType] = useState(s(props.profile, 'collaborator_type'));
  const [contentDevelopedByProvider, setContentDevelopedByProvider] = useState<boolean | null>(props.profile?.content_developed_by_provider == null ? null : b(props.profile, 'content_developed_by_provider'));
  const [contentDeveloper, setContentDeveloper] = useState(s(props.profile, 'content_developer'));
  const [targetAudience, setTargetAudience] = useState(s(props.profile, 'target_audience'));
  const [selectAllMedicalFields, setSelectAllMedicalFields] = useState(b(props.profile, 'select_all_medical_fields'));
  const [categorySpecific, setCategorySpecific] = useState(s(props.profile, 'category_specific'));
  const [learningGap, setLearningGap] = useState(s(props.profile, 'learning_gap'));
  const [aimAndOutcomes, setAimAndOutcomes] = useState(s(props.profile, 'aim_and_outcomes'));
  const [learningMethods, setLearningMethods] = useState(s(props.profile, 'learning_methods'));
  const [participantEvaluationMethod, setParticipantEvaluationMethod] = useState(s(props.profile, 'participant_evaluation_method'));
  const [activityScope, setActivityScope] = useState<'LOCAL' | 'INTERNATIONAL' | ''>((s(props.profile, 'activity_scope') as 'LOCAL' | 'INTERNATIONAL') || '');
  const [scfhsRegistrationNumber, setScfhsRegistrationNumber] = useState(s(props.profile, 'scfhs_registration_number'));

  const [needsTools, setNeedsTools] = useState<string[]>(props.needsAssessmentTools.map((row) => s(row, 'tool_code')));
  const [objectives, setObjectives] = useState<Objective[]>(props.objectives.length ? props.objectives.map((row, index) => ({ objectiveText: s(row, 'objective_text'), learningDomain: s(row, 'learning_domain'), sortOrder: Number(row.sort_order ?? index + 1) })) : [{ objectiveText: '', learningDomain: '', sortOrder: 1 }]);
  const [committeeMembers, setCommitteeMembers] = useState<CommitteeMember[]>(props.committeeMembers.length ? props.committeeMembers.map((row, index) => ({ fullName: s(row, 'full_name'), classificationNumber: s(row, 'professional_classification_number'), specialty: s(row, 'specialty'), institution: s(row, 'institution'), committeeRole: s(row, 'committee_role'), sortOrder: Number(row.sort_order ?? index + 1) })) : [{ fullName: '', classificationNumber: '', specialty: '', institution: '', committeeRole: '', sortOrder: 1 }]);
  const [speakers, setSpeakers] = useState<Speaker[]>(props.speakers.length ? props.speakers.map((row, index) => ({ clientKey: s(row, 'client_key') || newKey(), fullName: s(row, 'full_name_snapshot'), specialty: s(row, 'specialty_snapshot'), grade: s(row, 'grade_snapshot'), institution: s(row, 'institution_snapshot'), relatedExperiencePastThreeYears: s(row, 'related_experience_past_three_years'), qualificationsSummary: s(row, 'qualifications_summary'), specialCertificatesSummary: s(row, 'special_certificates_summary'), internationalPresentationsCount: row.international_presentations_count == null ? null : Number(row.international_presentations_count), sortOrder: Number(row.sort_order ?? index + 1) })) : [{ clientKey: newKey(), fullName: '', specialty: '', grade: '', institution: '', relatedExperiencePastThreeYears: '', qualificationsSummary: '', specialCertificatesSummary: '', internationalPresentationsCount: null, sortOrder: 1 }]);
  const [sessions, setSessions] = useState<Session[]>(props.sessions.length ? props.sessions.map((row, index) => ({ dayLabel: s(row, 'day_label'), topicName: s(row, 'topic_name'), startsAt: s(row, 'starts_at'), endsAt: s(row, 'ends_at'), sortOrder: Number(row.sort_order ?? index + 1), speakerKeys: Array.isArray(row.speaker_keys) ? (row.speaker_keys as string[]) : [] })) : [{ dayLabel: '', topicName: '', startsAt: '', endsAt: '', sortOrder: 1, speakerKeys: [] }]);
  const [disclosures, setDisclosures] = useState<Disclosure[]>(props.disclosures.length ? props.disclosures.map((row) => ({ personName: s(row, 'person_name'), personRole: s(row, 'person_role'), declarationStatus: (s(row, 'declaration_status') as Disclosure['declarationStatus']) || 'PENDING', commercialRelationshipSummary: s(row, 'commercial_relationship_summary') })) : []);

  const payload = useMemo(() => ({
    profile: {
      intakeRoute, specialty, activityLanguages: languages, collaboration,
      collaboratorOrganizationName: collaboratorName || null, collaboratorType: collaboratorType || null,
      contentDevelopedByProvider, contentDeveloper: contentDeveloper || null,
      targetAudience, selectAllMedicalFields, categorySpecific: categorySpecific || null,
      learningGap, aimAndOutcomes, learningMethods, participantEvaluationMethod,
      activityScope: activityScope || null, scfhsRegistrationNumber: scfhsRegistrationNumber || null,
      formStatus: 'DRAFT' as const,
    },
    needsAssessmentTools: needsTools.map((toolCode) => ({ toolCode, otherText: null })),
    objectives: objectives.map((item, index) => ({ ...item, sortOrder: index + 1 })),
    committeeMembers: committeeMembers.map((item, index) => ({ ...item, sortOrder: index + 1 })),
    speakers: speakers.map((item, index) => ({ ...item, sortOrder: index + 1 })),
    sessions: sessions.map((item, index) => ({ ...item, sortOrder: index + 1 })),
    disclosures,
  }), [intakeRoute, specialty, languages, collaboration, collaboratorName, collaboratorType, contentDevelopedByProvider, contentDeveloper, targetAudience, selectAllMedicalFields, categorySpecific, learningGap, aimAndOutcomes, learningMethods, participantEvaluationMethod, activityScope, scfhsRegistrationNumber, needsTools, objectives, committeeMembers, speakers, sessions, disclosures]);

  const toggleLanguage = (code: string) => setLanguages((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);
  const toggleNeed = (code: string) => setNeedsTools((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);

  return (
    <div className="space-y-8">
      <form action={saveAction} className="space-y-8">
        <input type="hidden" name="activityId" value={props.activity.id} />
        <input type="hidden" name="activityTitleAr" value={props.activity.titleAr} />
        <input type="hidden" name="activityTitleEn" value={props.activity.titleEn ?? ''} />
        <input type="hidden" name="activityType" value={props.activity.activityType ?? ''} />
        <input type="hidden" name="deliveryMethod" value={props.activity.deliveryMethod ?? ''} />
        <input type="hidden" name="payload" value={JSON.stringify(payload)} />

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">1. مسار إعداد النشاط</h2>
          <p className="mt-2 text-sm leading-7 text-slate-600">البيانات الرقمية وبيانات PDF المؤكدة تلتقي في سجل واحد. رفع PDF لا يلغي إمكانية استكمال الحقول داخل المنصة.</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {(['DIGITAL','PDF','HYBRID'] as const).map((route) => (
              <button key={route} type="button" onClick={() => setIntakeRoute(route)} className={`rounded-xl border px-4 py-3 text-sm font-bold ${intakeRoute===route ? 'border-teal-700 bg-teal-50 text-teal-900' : 'border-slate-200 bg-white text-slate-600'}`}>
                {route === 'DIGITAL' ? 'تعبئة رقمية' : route === 'PDF' ? 'PDF جاهز' : 'مسار هجين'}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black">2. البيانات التعليمية</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="text-sm font-bold">التخصص *<input className={`${inputClass} mt-2`} value={specialty} onChange={(e)=>setSpecialty(e.target.value)} /></label>
            <div><div className="text-sm font-bold">لغة النشاط *</div><div className="mt-3 flex gap-5">{[['AR','العربية'],['EN','English']].map(([code,label])=><label key={code} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={languages.includes(code)} onChange={()=>toggleLanguage(code)} />{label}</label>)}</div></div>
            <label className="md:col-span-2 text-sm font-bold">الفئة المستهدفة *<textarea className={`${textareaClass} mt-2`} value={targetAudience} onChange={(e)=>setTargetAudience(e.target.value)} /></label>
            <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={selectAllMedicalFields} onChange={(e)=>setSelectAllMedicalFields(e.target.checked)} />اختيار جميع المجالات الصحية</label>
            <label className="text-sm font-bold">Category specific<input className={`${inputClass} mt-2`} value={categorySpecific} onChange={(e)=>setCategorySpecific(e.target.value)} /></label>
            <label className="md:col-span-2 text-sm font-bold">Learning Need / Gap *<textarea className={`${textareaClass} mt-2`} value={learningGap} onChange={(e)=>setLearningGap(e.target.value)} /></label>
            <label className="md:col-span-2 text-sm font-bold">Aim & Learning Outcomes *<textarea className={`${textareaClass} mt-2`} value={aimAndOutcomes} onChange={(e)=>setAimAndOutcomes(e.target.value)} /></label>
            <label className="md:col-span-2 text-sm font-bold">Learning Methods / Delivery Format *<textarea className={`${textareaClass} mt-2`} value={learningMethods} onChange={(e)=>setLearningMethods(e.target.value)} /></label>
            <label className="md:col-span-2 text-sm font-bold">Participant / Activity Evaluation Method *<textarea className={`${textareaClass} mt-2`} value={participantEvaluationMethod} onChange={(e)=>setParticipantEvaluationMethod(e.target.value)} /></label>
          </div>
          <div className="mt-6"><div className="text-sm font-bold">Needs Assessment Tools</div><div className="mt-3 grid gap-2 sm:grid-cols-2">{[
            ['SURVEY','Surveys'],['QUESTIONNAIRE','Questionnaires'],['PLANNING_COMMITTEE_CONSULTATION','Consultation with planning committee'],['FOCUS_GROUP','Focus groups'],['DIRECT_TARGET_AUDIENCE_REQUEST','Direct requests from target audience']
          ].map(([code,label])=><label key={code} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={needsTools.includes(code)} onChange={()=>toggleNeed(code)} />{label}</label>)}</div></div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">3. SMART Learning Objectives</h2><button type="button" onClick={()=>setObjectives((x)=>[...x,{objectiveText:'',learningDomain:'',sortOrder:x.length+1}])} className="rounded-lg border border-teal-700 px-3 py-2 text-sm font-bold text-teal-800">+ هدف</button></div>
          <div className="mt-4 space-y-3">{objectives.map((objective,index)=><div key={index} className="grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-[1fr_180px_auto]"><textarea className={textareaClass} value={objective.objectiveText} onChange={(e)=>setObjectives((xs)=>xs.map((x,i)=>i===index?{...x,objectiveText:e.target.value}:x))} placeholder={`Objective ${index+1}`} /><select className={inputClass} value={objective.learningDomain} onChange={(e)=>setObjectives((xs)=>xs.map((x,i)=>i===index?{...x,learningDomain:e.target.value}:x))}><option value="">Domain</option><option value="KNOWLEDGE">Knowledge</option><option value="SKILL">Skill</option><option value="ATTITUDE">Attitude</option></select><button type="button" onClick={()=>setObjectives((xs)=>xs.filter((_,i)=>i!==index))} className="text-sm font-bold text-red-700">حذف</button></div>)}</div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">4. اللجنة العلمية الخاصة بالنشاط</h2><button type="button" onClick={()=>setCommitteeMembers((x)=>[...x,{fullName:'',classificationNumber:'',specialty:'',institution:'',committeeRole:'',sortOrder:x.length+1}])} className="rounded-lg border border-teal-700 px-3 py-2 text-sm font-bold text-teal-800">+ عضو</button></div>
          <p className="mt-2 text-sm text-slate-600">هذه اللجنة تخص النشاط فقط ولا تمثل اللجنة العلمية المؤسسية الدائمة.</p>
          <div className="mt-4 space-y-3">{committeeMembers.map((member,index)=><div key={index} className="grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-2"><input className={inputClass} placeholder="Full name *" value={member.fullName} onChange={(e)=>setCommitteeMembers((xs)=>xs.map((x,i)=>i===index?{...x,fullName:e.target.value}:x))}/><input className={inputClass} placeholder="Classification number" value={member.classificationNumber} onChange={(e)=>setCommitteeMembers((xs)=>xs.map((x,i)=>i===index?{...x,classificationNumber:e.target.value}:x))}/><input className={inputClass} placeholder="Specialty" value={member.specialty} onChange={(e)=>setCommitteeMembers((xs)=>xs.map((x,i)=>i===index?{...x,specialty:e.target.value}:x))}/><div className="flex gap-2"><input className={inputClass} placeholder="Institution / role" value={member.institution} onChange={(e)=>setCommitteeMembers((xs)=>xs.map((x,i)=>i===index?{...x,institution:e.target.value}:x))}/><button type="button" onClick={()=>setCommitteeMembers((xs)=>xs.filter((_,i)=>i!==index))} className="text-sm font-bold text-red-700">حذف</button></div></div>)}</div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">5. المتحدثون</h2><button type="button" onClick={()=>setSpeakers((x)=>[...x,{clientKey:newKey(),fullName:'',specialty:'',grade:'',institution:'',relatedExperiencePastThreeYears:'',qualificationsSummary:'',specialCertificatesSummary:'',internationalPresentationsCount:null,sortOrder:x.length+1}])} className="rounded-lg border border-teal-700 px-3 py-2 text-sm font-bold text-teal-800">+ متحدث</button></div>
          <div className="mt-4 space-y-4">{speakers.map((speaker,index)=><div key={speaker.clientKey} className="grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-2"><input className={inputClass} placeholder="Speaker name *" value={speaker.fullName} onChange={(e)=>setSpeakers((xs)=>xs.map((x,i)=>i===index?{...x,fullName:e.target.value}:x))}/><input className={inputClass} placeholder="Specialty" value={speaker.specialty} onChange={(e)=>setSpeakers((xs)=>xs.map((x,i)=>i===index?{...x,specialty:e.target.value}:x))}/><input className={inputClass} placeholder="Grade" value={speaker.grade} onChange={(e)=>setSpeakers((xs)=>xs.map((x,i)=>i===index?{...x,grade:e.target.value}:x))}/><input className={inputClass} placeholder="Institution" value={speaker.institution} onChange={(e)=>setSpeakers((xs)=>xs.map((x,i)=>i===index?{...x,institution:e.target.value}:x))}/><textarea className={textareaClass} placeholder="Related experience — past 3 years" value={speaker.relatedExperiencePastThreeYears} onChange={(e)=>setSpeakers((xs)=>xs.map((x,i)=>i===index?{...x,relatedExperiencePastThreeYears:e.target.value}:x))}/><textarea className={textareaClass} placeholder="Qualifications / certificates" value={speaker.qualificationsSummary} onChange={(e)=>setSpeakers((xs)=>xs.map((x,i)=>i===index?{...x,qualificationsSummary:e.target.value}:x))}/><button type="button" onClick={()=>setSpeakers((xs)=>xs.filter((_,i)=>i!==index))} className="justify-self-start text-sm font-bold text-red-700">حذف المتحدث</button></div>)}</div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-black">6. البرنامج العلمي / Agenda</h2><button type="button" onClick={()=>setSessions((x)=>[...x,{dayLabel:'',topicName:'',startsAt:'',endsAt:'',sortOrder:x.length+1,speakerKeys:[]}])} className="rounded-lg border border-teal-700 px-3 py-2 text-sm font-bold text-teal-800">+ جلسة</button></div>
          <div className="mt-4 space-y-3">{sessions.map((session,index)=><div key={index} className="grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-2"><input className={inputClass} placeholder="Day" value={session.dayLabel} onChange={(e)=>setSessions((xs)=>xs.map((x,i)=>i===index?{...x,dayLabel:e.target.value}:x))}/><input className={inputClass} placeholder="Topic name *" value={session.topicName} onChange={(e)=>setSessions((xs)=>xs.map((x,i)=>i===index?{...x,topicName:e.target.value}:x))}/><input className={inputClass} type="datetime-local" value={session.startsAt} onChange={(e)=>setSessions((xs)=>xs.map((x,i)=>i===index?{...x,startsAt:e.target.value}:x))}/><input className={inputClass} type="datetime-local" value={session.endsAt} onChange={(e)=>setSessions((xs)=>xs.map((x,i)=>i===index?{...x,endsAt:e.target.value}:x))}/><div className="md:col-span-2"><div className="mb-2 text-sm font-bold">Speakers</div><div className="flex flex-wrap gap-3">{speakers.filter((speaker)=>speaker.fullName.trim()).map((speaker)=><label key={speaker.clientKey} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm"><input type="checkbox" checked={session.speakerKeys.includes(speaker.clientKey)} onChange={()=>setSessions((xs)=>xs.map((x,i)=>i===index?{...x,speakerKeys:x.speakerKeys.includes(speaker.clientKey)?x.speakerKeys.filter((k)=>k!==speaker.clientKey):[...x.speakerKeys,speaker.clientKey]}:x))}/>{speaker.fullName}</label>)}</div></div><button type="button" onClick={()=>setSessions((xs)=>xs.filter((_,i)=>i!==index))} className="justify-self-start text-sm font-bold text-red-700">حذف الجلسة</button></div>)}</div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black">7. التعاون، تطوير المحتوى، والمعلومات الأخرى</h2>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="text-sm font-bold">Collaboration<select className={`${inputClass} mt-2`} value={collaboration==null?'':String(collaboration)} onChange={(e)=>setCollaboration(e.target.value===''?null:e.target.value==='true')}><option value="">اختر</option><option value="false">No</option><option value="true">Yes</option></select></label>
            <input className={inputClass} disabled={collaboration!==true} placeholder="Collaborator organization name" value={collaboratorName} onChange={(e)=>setCollaboratorName(e.target.value)}/>
            <input className={inputClass} disabled={collaboration!==true} placeholder="Collaborator type" value={collaboratorType} onChange={(e)=>setCollaboratorType(e.target.value)}/>
            <label className="text-sm font-bold">Content developed by applying provider?<select className={`${inputClass} mt-2`} value={contentDevelopedByProvider==null?'':String(contentDevelopedByProvider)} onChange={(e)=>setContentDevelopedByProvider(e.target.value===''?null:e.target.value==='true')}><option value="">اختر</option><option value="true">Yes</option><option value="false">No</option></select></label>
            <input className={inputClass} disabled={contentDevelopedByProvider!==false} placeholder="Who developed the content?" value={contentDeveloper} onChange={(e)=>setContentDeveloper(e.target.value)}/>
            <select className={inputClass} value={activityScope} onChange={(e)=>setActivityScope(e.target.value as typeof activityScope)}><option value="">Local / International</option><option value="LOCAL">Local</option><option value="INTERNATIONAL">International</option></select>
            <input className={inputClass} placeholder="SCFHS Registration #" value={scfhsRegistrationNumber} onChange={(e)=>setScfhsRegistrationNumber(e.target.value)}/>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between"><h2 className="text-xl font-black">8. Disclosure Register</h2><button type="button" onClick={()=>setDisclosures((x)=>[...x,{personName:'',personRole:'SPEAKER',declarationStatus:'PENDING',commercialRelationshipSummary:''}])} className="rounded-lg border border-teal-700 px-3 py-2 text-sm font-bold text-teal-800">+ إفصاح</button></div>
          <div className="mt-4 space-y-3">{disclosures.map((item,index)=><div key={index} className="grid gap-3 rounded-xl bg-slate-50 p-4 md:grid-cols-3"><input className={inputClass} placeholder="Name" value={item.personName} onChange={(e)=>setDisclosures((xs)=>xs.map((x,i)=>i===index?{...x,personName:e.target.value}:x))}/><input className={inputClass} placeholder="Role" value={item.personRole} onChange={(e)=>setDisclosures((xs)=>xs.map((x,i)=>i===index?{...x,personRole:e.target.value}:x))}/><select className={inputClass} value={item.declarationStatus} onChange={(e)=>setDisclosures((xs)=>xs.map((x,i)=>i===index?{...x,declarationStatus:e.target.value as Disclosure['declarationStatus']}:x))}><option value="PENDING">Pending</option><option value="DECLARED_NO_CONFLICT">No conflict declared</option><option value="DECLARED_CONFLICT">Conflict declared</option></select><textarea className={`${textareaClass} md:col-span-2`} placeholder="Commercial relationship summary / notes" value={item.commercialRelationshipSummary} onChange={(e)=>setDisclosures((xs)=>xs.map((x,i)=>i===index?{...x,commercialRelationshipSummary:e.target.value}:x))}/><button type="button" onClick={()=>setDisclosures((xs)=>xs.filter((_,i)=>i!==index))} className="justify-self-start text-sm font-bold text-red-700">حذف</button></div>)}</div>
        </section>

        {saveState.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{saveState.error}</p> : null}
        <div className="flex flex-wrap justify-end gap-3"><button name="targetStatus" value="DRAFT" disabled={savePending} className="rounded-xl border border-teal-800 px-5 py-3 font-bold text-teal-900">حفظ كمسودة</button><button name="targetStatus" value="CONFIRMED" disabled={savePending} className="rounded-xl bg-teal-800 px-5 py-3 font-bold text-white">تأكيد البيانات</button></div>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black">رفع نموذج PDF مكتمل</h2>
        <p className="mt-2 text-sm leading-7 text-slate-600">يحفظ الأصل كما هو مع SHA-256، ثم يجرب استخراج النص الأصلي. الحقول منخفضة الثقة تبقى UNCERTAIN حتى تؤكدها أنت.</p>
        <form action={uploadAction} className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
          <input type="hidden" name="activityId" value={props.activity.id}/><label className="flex-1 text-sm font-bold">Completed Activity Form PDF<input name="file" type="file" accept="application/pdf" required className={`${inputClass} mt-2`} /></label><button disabled={uploadPending} className="rounded-xl bg-slate-900 px-5 py-3 font-bold text-white">{uploadPending?'جارٍ الرفع والاستخراج…':'رفع واستخراج'}</button>
        </form>
        {uploadState.error ? <p role="alert" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{uploadState.error}</p> : null}
      </section>
    </div>
  );
}
