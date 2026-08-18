(() => {
  'use strict';

  const roles = {
    PLATFORM_SUPER_ADMIN: {
      label: 'مسؤول المنصة العام',
      mission: 'إدارة نطاق المنصة وعزل المؤسسات ومراقبة سلامة الخدمة.',
      boundary: 'لا يدخل تلقائيًا إلى بيانات المؤسسة ولا ينشئ نشاطًا.',
      pages: ['dash'],
    },
    ORGANIZATION_SYSTEM_ADMIN: {
      label: 'مسؤول النظام المؤسسي',
      mission: 'إنشاء الأنشطة وتعيين المسؤولين وإدارة العضوية ومتابعة جميع مسارات المؤسسة.',
      boundary: 'لا يصدر القرار العلمي النهائي ولا يعتمد تقرير الأثر.',
      pages: ['dash', 'dossiers', 'admin', 'activities', 'planning', 'committee', 'external', 'impact', 'annual', 'reports', 'evidence', 'notifications', 'templates', 'audit'],
    },
    ACTIVITY_OFFICER: {
      label: 'مسؤول النشاط',
      mission: 'استكمال ملف النشاط والأدلة، معالجة نواقص الجاهزية، وتسجيل المتابعة الخارجية والأثر.',
      boundary: 'لا ينشئ سجل النشاط ولا يعتمد قرار اللجنة أو التقرير النهائي.',
      pages: ['dash', 'dossiers', 'activities', 'planning', 'external', 'impact', 'evidence', 'notifications'],
    },
    COMMITTEE_SECRETARY: {
      label: 'سكرتير اللجنة',
      mission: 'تنظيم جدول الأعمال وتسجيل النتيجة الجماعية وإعداد محضر الاجتماع.',
      boundary: 'لا يصدر قرار رئيس اللجنة ولا يعتمد المحضر النهائي.',
      pages: ['dash', 'dossiers', 'activities', 'planning', 'committee', 'external', 'impact', 'annual', 'reports', 'evidence', 'notifications'],
    },
    COMMITTEE_CHAIR: {
      label: 'رئيس اللجنة',
      mission: 'حسم القرار العلمي الداخلي واعتماد المحاضر وتقارير الأثر والمخرجات العلمية.',
      boundary: 'القرار الداخلي يعني الجاهزية للرفع ولا يمثل اعتماد الهيئة.',
      pages: ['dash', 'dossiers', 'activities', 'planning', 'committee', 'external', 'impact', 'annual', 'reports', 'evidence', 'notifications'],
    },
    COMMITTEE_MEMBER: {
      label: 'عضو اللجنة',
      mission: 'مراجعة المعايير والأدلة وإضافة ملاحظات علمية قابلة للتتبع.',
      boundary: 'لا يسجل النتيجة الجماعية ولا يصدر القرار النهائي.',
      pages: ['dash', 'activities', 'planning', 'committee', 'notifications'],
    },
    MANAGEMENT_VIEWER: {
      label: 'مستخدم إداري للعرض',
      mission: 'متابعة الأداء والاعتماد الخارجي ومؤشرات الأثر والتقارير.',
      boundary: 'قراءة فقط؛ لا يعدل السجلات ولا يعتمد القرارات.',
      pages: ['dash', 'external', 'impact', 'annual', 'reports', 'evidence', 'notifications'],
    },
    MANAGEMENT_APPROVER: {
      label: 'المخول الإداري',
      mission: 'تنفيذ نقاط الاعتماد الإداري وإدارة إصدارات القوالب ضمن فصل المهام.',
      boundary: 'لا يكوّن السجل الذي يعتمده ولا يتخذ القرار العلمي.',
      pages: ['dash', 'external', 'impact', 'annual', 'reports', 'evidence', 'notifications', 'templates'],
    },
    AUDITOR: {
      label: 'المدقق',
      mission: 'فحص الأدلة والتقارير وسلسلة الأحداث دون تغيير البيانات.',
      boundary: 'صلاحية قراءة وتصدير فقط؛ سجل التدقيق غير قابل للتعديل.',
      pages: ['dash', 'external', 'impact', 'annual', 'reports', 'evidence', 'notifications', 'audit'],
    },
  };

  const storageKeys = {
    activity: 'cpd-demo-v4-activity',
    impact: 'cpd-demo-v4-impact',
    created: 'cpd-demo-v4-created-activities',
  };

  const byId = (id) => document.getElementById(id);
  const all = (selector, root = document) => [...root.querySelectorAll(selector)];
  let activeRole = 'ORGANIZATION_SYSTEM_ADMIN';
  let activityPdfReady = false;

  function showToast(message) {
    const toast = byId('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.add('hidden'), 3200);
  }

  function openPage(pageId) {
    const navButton = document.querySelector(`.nav [data-page="${pageId}"]`);
    if (!navButton || navButton.hidden) {
      showToast('هذه المساحة ليست ضمن صلاحيات الدور النشط.');
      return;
    }
    all('.nav [data-page]').forEach((button) => button.classList.toggle('active', button === navButton));
    all('.page').forEach((page) => page.classList.toggle('active', page.id === pageId));
    byId('pageTitle').textContent = navButton.dataset.title;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function applyPermissions(roleCode) {
    const readOnly = ['AUDITOR', 'MANAGEMENT_VIEWER'].includes(roleCode);
    all('[data-roles], [data-mutate]').forEach((control) => {
      const allowedRoles = (control.dataset.roles || '').split(/\s+/).filter(Boolean);
      const allowed = allowedRoles.length ? allowedRoles.includes(roleCode) : !readOnly;
      if ('disabled' in control) control.disabled = !allowed;
      control.setAttribute('aria-disabled', String(!allowed));
      if (!allowed) control.title = 'غير متاح للدور النشط';
      else if (control.title === 'غير متاح للدور النشط') control.removeAttribute('title');
    });
  }

  function applyRole(roleCode) {
    const role = roles[roleCode];
    activeRole = roleCode;
    all('.nav [data-page]').forEach((button) => {
      button.hidden = !role.pages.includes(button.dataset.page);
    });
    byId('roleText').textContent = role.label;
    byId('roleGuideTitle').textContent = role.label;
    byId('roleMission').textContent = role.mission;
    byId('roleBoundary').textContent = role.boundary;
    applyPermissions(roleCode);
    renderDossierRegistry();
    openPage('dash');
  }

  function serializeForm(form) {
    return Object.fromEntries(
      [...new FormData(form).entries()]
        .filter(([, value]) => typeof value === 'string')
        .map(([key, value]) => [key, value]),
    );
  }

  function restoreForm(form, values) {
    if (!values) return;
    Object.entries(values).forEach(([name, value]) => {
      const control = form.elements.namedItem(name);
      if (control && typeof value === 'string' && 'value' in control) control.value = value;
    });
  }

  function safeStoredJson(key, fallback) {
    try {
      return JSON.parse(localStorage.getItem(key) || '') || fallback;
    } catch {
      return fallback;
    }
  }

  function validateSelectedFile(input) {
    const file = input.files?.[0];
    const status = input.dataset.fileStatus ? byId(input.dataset.fileStatus) : null;
    if (!file) return false;
    const acceptsDocx = input.accept.includes('.docx');
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isDocx = acceptsDocx && file.name.toLowerCase().endsWith('.docx');
    if (!isPdf && !isDocx) {
      input.value = '';
      if (status) status.textContent = 'نوع الملف غير مقبول';
      showToast('تم رفض الملف: اختر PDF فقط لهذا الحقل.');
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      input.value = '';
      if (status) status.textContent = 'يتجاوز الملف حد 10 MB';
      showToast('تم رفض الملف لأنه يتجاوز 10 MB في بيئة العرض.');
      return false;
    }
    if (status) status.textContent = `${file.name} · ${(file.size / 1024).toFixed(1)} KB · جاهز`;
    return true;
  }

  function updateCheck(key, complete) {
    const cell = document.querySelector(`[data-check="${key}"]`);
    if (!cell) return;
    cell.innerHTML = `<span class="badge ${complete ? '' : 'danger'}">${complete ? 'مكتمل' : 'مطلوب'}</span>`;
  }

  function checkActivityReadiness({ announce = true } = {}) {
    const core = ['activityTitle', 'activityTitleEn', 'activityType', 'capacity'].every((id) => byId(id).value.trim());
    const gap = Boolean(byId('gapStatement').value.trim());
    const objectives = Boolean(byId('learningObjectives').value.trim());
    const audience = Boolean(byId('targetAudience').value.trim());
    const schedule = ['activityStart', 'activityEnd', 'cpdHours'].every((id) => byId(id).value.trim());
    const states = { core, gap, objectives, audience, schedule, pdf: activityPdfReady };
    Object.entries(states).forEach(([key, complete]) => updateCheck(key, complete));
    const complete = 3 + Object.values(states).filter(Boolean).length;
    byId('readinessScore').textContent = `${complete} / 9`;
    byId('readinessBar').style.width = `${(complete / 9) * 100}%`;
    const missing = Object.entries(states).filter(([, value]) => !value).map(([key]) => ({ core: 'البيانات الأساسية', gap: 'الفجوة المهنية', objectives: 'الأهداف', audience: 'الفئة المستهدفة', schedule: 'المدة والساعات', pdf: 'النموذج الرسمي PDF' })[key]);
    byId('readinessMessage').textContent = complete === 9
      ? 'الملف مكتمل وجاهز للإرسال إلى المراجعة المسبقة.'
      : `المتبقي: ${missing.join('، ')}.`;
    if (announce) showToast(complete === 9 ? 'نجح الفحص: الملف مكتمل 9/9.' : `الفحص لم ينجح بعد: ${complete}/9 مكتمل.`);
    return complete;
  }

  function syncActivityPrint() {
    byId('printActivityCode').textContent = byId('activityCode').value;
    byId('printActivityTitle').textContent = byId('activityTitle').value;
    byId('printActivityDates').textContent = `${byId('activityStart').value} — ${byId('activityEnd').value}`;
    byId('printActivityHours').textContent = byId('cpdHours').value;
    byId('printActivityAudience').textContent = byId('targetAudience').value;
    byId('printDeliveryMethod').textContent = byId('deliveryMethod').value;
    byId('printGap').textContent = byId('gapStatement').value;
    byId('printObjectives').textContent = byId('learningObjectives').value;
    byId('printPdfStatus').textContent = activityPdfReady ? 'مرفق في الجلسة' : 'بانتظار الرفع';
  }

  function printSheet(sheetId) {
    if (sheetId === 'activityApplicationReport') {
      printOfficialFormDemo();
      return;
    }
    all('.sheet').forEach((sheet) => sheet.classList.toggle('print-target', sheet.id === sheetId));
    document.body.dataset.lastPrintTarget = sheetId;
    window.print();
    window.setTimeout(() => all('.sheet').forEach((sheet) => sheet.classList.remove('print-target')), 250);
  }

  function previewSheet(sheetId) {
    if (sheetId === 'activityApplicationReport') {
      byId('officialFormDialog').showModal();
      return;
    }
    const target = byId(sheetId);
    all('.sheet').forEach((sheet) => {
      if (sheet !== target) sheet.classList.remove('preview');
    });
    target.classList.toggle('preview');
    if (target.classList.contains('preview')) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function printOfficialFormDemo() {
    if (byId('officialFormDialog').open) byId('officialFormDialog').close();
    document.body.classList.add('printing-official-form');
    document.body.dataset.lastPrintTarget = 'officialFormPrint';
    window.print();
    window.setTimeout(() => document.body.classList.remove('printing-official-form'), 250);
  }

  function calculateHtvi() {
    let total = 0;
    all('.impact-score').forEach((input) => {
      const value = Math.min(100, Math.max(0, Number(input.value) || 0));
      const contribution = value * Number(input.dataset.weight);
      total += contribution;
      const contributionCell = byId(input.id.replace('Score', 'Contribution'));
      if (contributionCell) contributionCell.textContent = contribution.toFixed(1);
    });
    const formatted = total.toFixed(1);
    byId('htviScore').textContent = formatted;
    all('.liveHtvi').forEach((element) => { element.textContent = formatted; });
    return formatted;
  }

  function appendCell(row, text) {
    const cell = row.insertCell();
    cell.textContent = text;
    return cell;
  }

  function appendCreatedActivity(activity, persist = true) {
    const tableBody = byId('activityAdminTable').tBodies[0];
    if (all('tr', tableBody).some((row) => row.cells[0]?.textContent === activity.code)) return;
    const row = tableBody.insertRow(0);
    appendCell(row, activity.code);
    appendCell(row, activity.title);
    appendCell(row, activity.type);
    appendCell(row, activity.start);
    appendCell(row, activity.officer);
    appendCell(row, '1 / 9');
    const stateCell = row.insertCell();
    const state = document.createElement('span');
    state.className = 'badge neutral';
    state.textContent = 'مسودة';
    stateCell.append(state);
    const actionCell = row.insertCell();
    const action = document.createElement('button');
    action.className = 'btn small';
    action.type = 'button';
    action.textContent = 'فتح الملف';
    action.addEventListener('click', () => openPage('activities'));
    actionCell.append(action);
    const count = tableBody.rows.length;
    byId('activityCount').textContent = String(count);
    if (persist) {
      const created = safeStoredJson(storageKeys.created, []);
      created.push(activity);
      localStorage.setItem(storageKeys.created, JSON.stringify(created));
    }
  }

  function prependAudit(action, entity, change) {
    const tbody = byId('auditTable').tBodies[0];
    const row = tbody.insertRow(0);
    const sequence = String(9185 + tbody.rows.length).padStart(6, '0');
    [sequence, new Date().toLocaleString('ar-SA'), action, entity, 'المستخدم التجريبي', activeRole, change].forEach((value) => appendCell(row, value));
    const hash = appendCell(row, `demo-${Date.now().toString(16)}…`);
    hash.className = 'audit-hash';
  }

  function filterTable(input) {
    const query = input.value.trim().toLowerCase();
    const table = byId(input.dataset.filterTable);
    all('tbody tr', table).forEach((row) => {
      row.hidden = Boolean(query) && !row.textContent.toLowerCase().includes(query);
    });
  }

  const dossierCategoryLabels = {
    OFFICIAL_FORM: 'النموذج الرسمي', COMMITTEE_DECISION: 'قرار اللجنة',
    COMMITTEE_MINUTES: 'محضر اللجنة', FINAL_IMPACT_REPORT: 'تقرير الأثر النهائي',
    ADDITIONAL_ATTACHMENT: 'مرفق إضافي',
  };

  function visibleSyntheticDossiers() {
    const dossiers = window.CPD_ACTIVITY_DOSSIERS || [];
    if (activeRole === 'ACTIVITY_OFFICER') {
      return dossiers.filter((item) => item.assignedOfficerId === 'demo-officer-sara');
    }
    return dossiers;
  }

  function renderDossierRegistry() {
    const table = byId('dossierRegistryTable');
    if (!table) return;
    const year = byId('dossierYear').value;
    const department = byId('dossierDepartment').value;
    const search = byId('dossierSearch').value.trim().toLowerCase();
    const rows = visibleSyntheticDossiers().filter((item) =>
      (!year || String(item.reportingYear) === year)
      && (!department || item.department.id === department)
      && (!search || [item.activityCode, item.titleAr, item.titleEn].some((value) => String(value || '').toLowerCase().includes(search)))
    );
    const tbody = table.tBodies[0];
    tbody.replaceChildren();
    rows.forEach((item) => {
      const row = tbody.insertRow();
      appendCell(row, item.activityCode);
      const titleCell = appendCell(row, item.titleAr);
      const english = document.createElement('small'); english.className = 'dossier-title-en'; english.textContent = item.titleEn; titleCell.append(english);
      appendCell(row, String(item.reportingYear));
      appendCell(row, item.department.nameAr);
      appendCell(row, item.assignedOfficer);
      appendCell(row, `${item.committeeComplete}/5`);
      appendCell(row, `${item.postActivityComplete}/1`);
      const actionCell = row.insertCell();
      const button = document.createElement('button'); button.type = 'button'; button.className = 'btn small primary'; button.textContent = 'فتح الملف';
      button.addEventListener('click', () => openSyntheticDossier(item.id)); actionCell.append(button);
    });
    byId('dossierEmpty').classList.toggle('hidden', rows.length !== 0);
    const annual = byId('annualDossierLink');
    annual.classList.toggle('hidden', !year || !roles[activeRole].pages.includes('annual'));
    if (year) annual.textContent = `التقرير السنوي ${year}`;
  }

  function resetDossierFilters() {
    byId('dossierYear').value = '';
    byId('dossierDepartment').value = '';
    byId('dossierSearch').value = '';
  }

  function openSyntheticDossier(activityId) {
    const dossier = visibleSyntheticDossiers().find((item) => item.id === activityId);
    if (!dossier) { showToast('هذا النشاط غير مسند إلى مسؤول النشاط الحالي.'); return; }
    const documentRows = dossier.documents.map((document) => `<tr><td>${dossierCategoryLabels[document.category]}</td><td>${document.filename}</td><td>v${document.version}</td><td><span class="badge ${document.state.includes('RETURNED') ? 'warning' : ''}">${document.state}</span></td><td><button type="button" class="btn small demo-document-action" data-document-category="${document.category}">فتح / تحميل</button></td></tr>`).join('');
    const container = byId('demoDossier');
    container.innerHTML = `<div class="card panel dossier-heading"><div><span class="eyebrow">ملف عرض مصطنع · Contract v${dossier.contractVersion}</span><h2>${dossier.titleAr}</h2><p class="ltr">${dossier.titleEn}</p></div><button type="button" class="btn small" id="closeDemoDossier">إغلاق الملف</button></div>
      <div class="dossier-grid"><div>
        <section class="card panel"><h3>1. ملخص النشاط</h3><div class="dossier-meta"><div><span>الرمز</span><b class="ltr">${dossier.activityCode}</b></div><div><span>القسم</span><b>${dossier.department.nameAr}</b></div><div><span>مسؤول النشاط</span><b>${dossier.assignedOfficer}</b></div><div><span>قرار اللجنة</span><b>${dossier.committeeDecision || 'لم يصدر'}</b></div></div></section>
        <section class="card panel"><h3>2–5. النموذج، اللجنة، الأثر والمرفقات</h3><div class="table-wrap"><table class="data-table compact"><thead><tr><th>الفئة</th><th>الملف</th><th>الإصدار</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody>${documentRows}</tbody></table></div><div class="actions dossier-actions"><button class="btn secondary" type="button" id="showOfficialFormDemo">معاينة النموذج الرسمي 6 صفحات</button><button class="btn secondary" type="button" id="openImpactFromDossier">تعبئة / عرض L1–L4</button></div><label class="upload-box" data-roles="ORGANIZATION_SYSTEM_ADMIN ACTIVITY_OFFICER"><span><b>رفع مرفق إضافي</b><small>PDF أو DOCX أو JPG أو PNG — عرض محلي فقط</small><input id="demoDossierAttachment" type="file" accept=".pdf,.docx,.jpg,.jpeg,.png"></span></label></section>
      </div><aside><section class="card panel"><h3>6. الجاهزية</h3><div class="dossier-readiness"><div><strong>${dossier.committeeComplete}/5</strong><span>قبل اللجنة</span></div><div><strong>${dossier.postActivityComplete}/1</strong><span>ما بعد النشاط</span></div></div><p class="report-note">تقرير الأثر النهائي لا يدخل ضمن جاهزية ما قبل اللجنة.</p></section><section class="card panel"><h3>7. سجل التدقيق</h3><ol class="dossier-audit"><li>فتح الملف بالدور ${roles[activeRole].label}</li><li>آخر تحديث تجريبي: 18/08/2026</li><li>البيانات مصطنعة ولا تُرسل خارجيًا</li></ol></section></aside></div>`;
    container.classList.remove('hidden');
    applyPermissions(activeRole);
    byId('closeDemoDossier').addEventListener('click', () => container.classList.add('hidden'));
    byId('showOfficialFormDemo').addEventListener('click', () => byId('officialFormDialog').showModal());
    byId('openImpactFromDossier').addEventListener('click', () => openPage('impact'));
    all('.demo-document-action', container).forEach((button) => button.addEventListener('click', () => {
      if (button.dataset.documentCategory === 'OFFICIAL_FORM') byId('officialFormDialog').showModal();
      else showToast('تم فتح المستند التجريبي في وضع العرض دون تنزيل بيانات حقيقية.');
    }));
    byId('demoDossierAttachment').addEventListener('change', (event) => {
      const file = event.currentTarget.files?.[0];
      if (file) showToast(`تمت إضافة ${file.name} محليًا إلى ملف العرض.`);
    });
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  byId('loginForm').addEventListener('submit', (event) => {
    event.preventDefault();
    byId('login').classList.add('hidden');
    byId('app').classList.remove('hidden');
    resetDossierFilters();
    applyRole(byId('role').value);
  });

  byId('logout').addEventListener('click', () => {
    byId('app').classList.add('hidden');
    byId('login').classList.remove('hidden');
  });

  all('.nav [data-page]').forEach((button) => button.addEventListener('click', () => openPage(button.dataset.page)));
  all('[data-goto]').forEach((button) => button.addEventListener('click', () => openPage(button.dataset.goto)));
  all('[data-preview]').forEach((button) => button.addEventListener('click', () => previewSheet(button.dataset.preview)));
  all('[data-print]').forEach((button) => button.addEventListener('click', () => printSheet(button.dataset.print)));
  const officialFormRegisterRow = document.querySelector('[data-preview="activityApplicationReport"]')?.closest('tr');
  if (officialFormRegisterRow) {
    officialFormRegisterRow.cells[0].textContent = 'النموذج الرسمي المطابق للمصدر';
    officialFormRegisterRow.cells[2].textContent = 'v1 مقفل المصدر';
    officialFormRegisterRow.cells[4].textContent = '6 Letter';
    officialFormRegisterRow.cells[5].textContent = 'حسب النموذج المرفوع';
  }
  all('[data-filter-table]').forEach((input) => input.addEventListener('input', () => filterTable(input)));
  ['dossierYear', 'dossierDepartment'].forEach((id) => byId(id).addEventListener('change', renderDossierRegistry));
  byId('dossierSearch').addEventListener('input', renderDossierRegistry);
  byId('annualDossierLink').addEventListener('click', (event) => { event.preventDefault(); openPage('annual'); });
  byId('printOfficialFormDemo').addEventListener('click', printOfficialFormDemo);

  byId('openActivityDialog').addEventListener('click', () => byId('activityDialog').showModal());
  byId('openTemplateDialog').addEventListener('click', () => byId('templateDialog').showModal());
  all('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => byId(button.dataset.closeDialog).close()));

  all('input[type="file"][data-file-status]').forEach((input) => input.addEventListener('change', () => {
    const accepted = validateSelectedFile(input);
    if (input.id === 'activityPdf') {
      activityPdfReady = accepted;
      checkActivityReadiness({ announce: false });
    }
  }));

  byId('activityCreateForm').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const existing = byId('activityAdminTable').tBodies[0].rows.length + 1;
    const activity = {
      code: `HT-2026-${String(existing).padStart(3, '0')}`,
      title: byId('newTitleAr').value.trim(),
      type: byId('newType').value,
      start: byId('newStart').value,
      officer: byId('newOfficer').value,
    };
    appendCreatedActivity(activity);
    prependAudit('ACTIVITY_CREATED', activity.code, `NONE ← DRAFT · ${activity.officer}`);
    byId('activityDialog').close();
    event.currentTarget.reset();
    showToast(`تم إنشاء ${activity.code} وإسناده إلى ${activity.officer}.`);
  });

  byId('saveActivityDraft').addEventListener('click', () => {
    localStorage.setItem(storageKeys.activity, JSON.stringify(serializeForm(byId('activityIntakeForm'))));
    prependAudit('ACTIVITY_DRAFT_SAVED', byId('activityCode').value, 'DRAFT ← DRAFT');
    showToast('تم حفظ مسودة ملف النشاط داخل المتصفح.');
  });
  byId('checkReadiness').addEventListener('click', () => checkActivityReadiness());
  byId('printActivity').addEventListener('click', () => byId('officialFormDialog').showModal());

  byId('runPlanningCheck').addEventListener('click', () => {
    const thirdObjective = byId('objectivesTable').tBodies[0].rows[2];
    const text = thirdObjective.querySelector('input').value.trim();
    const measurable = !/يفهم|يعرف|يدرك/.test(text);
    const resultCell = thirdObjective.cells[5];
    resultCell.innerHTML = `<span class="badge ${measurable ? '' : 'warning'}">${measurable ? 'MEET' : 'PARTIAL'}</span>`;
    byId('planningSummary').textContent = measurable ? '3 مستوفٍ · 0 ملاحظات' : '2 مستوفٍ · 1 يحتاج مراجعة';
    showToast(measurable ? 'اكتمل الفحص: جميع الأهداف قابلة للقياس.' : 'اكتمل الفحص: الهدف الثالث يحتاج فعلًا قابلًا للرصد.');
  });

  byId('committeeReviewForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const results = all('.criterion-result').map((select) => select.value);
    const collective = results.includes('NOT MEET') ? 'NOT MEET' : results.includes('PARTIAL') ? 'PARTIAL' : 'MEET';
    byId('committeeReviewStatus').textContent = `${collective} · مثبت`;
    byId('committeeReviewStatus').className = `badge ${collective === 'MEET' ? '' : 'warning'}`;
    prependAudit('COLLECTIVE_REVIEW_RECORDED', 'HT-2026-002', `DRAFT ← ${collective}`);
    showToast(`تم تسجيل النتيجة الجماعية: ${collective}.`);
  });

  byId('chairDecisionForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const decision = byId('chairDecision').value;
    byId('chairDecisionStatus').textContent = decision;
    byId('chairDecisionStatus').className = decision.startsWith('APPROVED') ? 'badge' : 'badge warning';
    prependAudit('CHAIR_DECISION_RECORDED', 'HT-2026-002', `PENDING ← ${decision}`);
    showToast('تم اعتماد قرار رئيس اللجنة وحفظ حيثياته.');
  });

  byId('externalTrackingForm').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const tbody = byId('externalHistoryTable').tBodies[0];
    const row = tbody.insertRow(0);
    [byId('externalDecisionDate').value || byId('submittedAt').value, byId('externalStatus').value, byId('submissionReference').value, byId('approvedHours').value || '—', roles[activeRole].label, byId('externalDecisionPdf').files?.[0]?.name || 'بدون مرفق جديد'].forEach((value) => appendCell(row, value));
    prependAudit('EXTERNAL_STATUS_UPDATED', 'HT-2026-001', `EXTERNAL ← ${byId('externalStatus').value}`);
    showToast('تم حفظ التحديث الخارجي وإضافته إلى السجل الزمني.');
  });

  all('.impact-score').forEach((input) => input.addEventListener('input', calculateHtvi));
  byId('saveImpact').addEventListener('click', () => {
    const values = Object.fromEntries(all('.impact-score').map((input) => [input.id, input.value]));
    localStorage.setItem(storageKeys.impact, JSON.stringify(values));
    showToast(`تم حفظ القياسات. HTVI الحالي: ${calculateHtvi()}.`);
  });
  byId('finalizeImpact').addEventListener('click', () => {
    byId('impactState').textContent = 'FINAL · معتمد';
    prependAudit('IMPACT_FINALIZED', 'HT-2026-001', `DRAFT ← FINAL · HTVI ${calculateHtvi()}`);
    showToast('تم اعتماد تقرير الأثر النهائي.');
  });

  byId('annualFilterForm').addEventListener('submit', (event) => {
    event.preventDefault();
    showToast('تم تطبيق نطاق التقرير السنوي.');
  });

  all('.evidence-file').forEach((input) => input.addEventListener('change', () => {
    const accepted = validateSelectedFile(input);
    if (!accepted) return;
    const row = input.closest('tr');
    const file = input.files[0];
    row.cells[2].textContent = file.name;
    row.cells[3].textContent = 'v جديد';
    row.cells[4].textContent = roles[activeRole].label;
    row.cells[5].textContent = new Date().toLocaleDateString('ar-SA');
    row.cells[6].innerHTML = '<span class="badge">مرفوع · بانتظار التحقق</span>';
    if (input.hasAttribute('data-missing-evidence')) byId('evidenceSummary').textContent = '9 / 9 مرفوع';
    prependAudit('EVIDENCE_UPLOADED', 'HT-2026-003', `NONE ← ${file.name}`);
    showToast(`تم رفع ${file.name} كإصدار جديد.`);
  }));

  function markNotificationRowRead(row) {
    row.dataset.unread = 'false';
    const state = row.querySelector('.notification-state');
    state.textContent = 'مقروء';
    state.className = 'badge neutral notification-state';
    row.querySelector('.mark-read')?.remove();
  }
  all('.mark-read').forEach((button) => button.addEventListener('click', () => markNotificationRowRead(button.closest('tr'))));
  byId('markAllRead').addEventListener('click', () => {
    all('#notificationsTable tbody tr').forEach(markNotificationRowRead);
    showToast('تم تحديد جميع الإشعارات كمقروءة.');
  });
  byId('notificationFilter').addEventListener('change', (event) => {
    const value = event.currentTarget.value;
    all('#notificationsTable tbody tr').forEach((row) => {
      row.hidden = value === 'unread' ? row.dataset.unread !== 'true' : value === 'due' ? row.dataset.due !== 'true' : false;
    });
  });

  byId('templateUploadForm').addEventListener('submit', (event) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity() || !validateSelectedFile(byId('templateFile'))) return;
    const row = byId('templatesTable').tBodies[0].insertRow(0);
    [byId('templateFamily').value, byId('templateVersion').value, byId('templateStart').value, byId('templateEnd').value, roles[activeRole].label, 'بانتظار الفحص', 'DRAFT'].forEach((value) => appendCell(row, value));
    const actionCell = row.insertCell();
    actionCell.textContent = '—';
    prependAudit('TEMPLATE_VERSION_UPLOADED', byId('templateFamily').value, `NONE ← v${byId('templateVersion').value}`);
    byId('templateDialog').close();
    showToast('تم رفع إصدار القالب للفحص والجودة دون استبدال الإصدارات السابقة.');
  });

  byId('auditFilterForm').addEventListener('submit', (event) => {
    event.preventDefault();
    filterTable(byId('auditSearch'));
    showToast('تم تطبيق مرشحات سجل التدقيق.');
  });
  byId('exportAudit').addEventListener('click', () => {
    const rows = all('#auditTable tr').filter((row) => !row.hidden).map((row) => all('th,td', row).map((cell) => `"${cell.textContent.trim().replaceAll('"', '""')}"`).join(','));
    const blob = new Blob([`\uFEFF${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'cpd-audit-demo.csv';
    link.click();
    URL.revokeObjectURL(link.href);
    showToast('تم إنشاء ملف CSV لسجل التدقيق الظاهر.');
  });

  byId('resetDemo').addEventListener('click', () => {
    if (!window.confirm('إعادة بيانات العرض المحفوظة في هذا المتصفح؟')) return;
    Object.values(storageKeys).forEach((key) => localStorage.removeItem(key));
    window.location.reload();
  });

  restoreForm(byId('activityIntakeForm'), safeStoredJson(storageKeys.activity, null));
  const storedImpact = safeStoredJson(storageKeys.impact, null);
  if (storedImpact) Object.entries(storedImpact).forEach(([id, value]) => { if (byId(id)) byId(id).value = value; });
  safeStoredJson(storageKeys.created, []).forEach((activity) => appendCreatedActivity(activity, false));
  calculateHtvi();
  syncActivityPrint();
})();
