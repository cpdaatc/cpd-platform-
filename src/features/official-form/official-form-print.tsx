import {
  OFFICIAL_FORM_FIELDS,
  validateOfficialFormValues,
  type OfficialFormFieldKey,
  type OfficialFormValues,
} from './field-map';

export function OfficialFormPrint({ values }: { values: OfficialFormValues }) {
  const overflows = validateOfficialFormValues(values);
  return <>
    {overflows.length > 0 ? <div className="no-print mb-4 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-950" role="alert">
      <strong>تعذر اعتماد الطباعة: بعض القيم تتجاوز مساحة النموذج الرسمي.</strong>
      <ul className="mt-2 list-inside list-disc text-xs">{overflows.map((overflow) => <li key={overflow.field}>{overflow.field}: {overflow.actualCharacters}/{overflow.maxCharacters}</li>)}</ul>
    </div> : null}
    <div className="official-form-print-root" data-page-count="6" data-page-size="Letter">
      {[1, 2, 3, 4, 5, 6].map((page) => <article key={page} className="schs-letter-page" data-official-form-page={page}>
        {/* This image is a direct render of the user-provided Word template. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="schs-letter-artwork" src={`/templates/schs-activity-application-v1/page-${page}.png`} alt={`صفحة النموذج الرسمي ${page} من 6`} />
        {(Object.entries(OFFICIAL_FORM_FIELDS) as Array<[OfficialFormFieldKey, (typeof OFFICIAL_FORM_FIELDS)[OfficialFormFieldKey]]>)
          .filter(([, placement]) => placement.page === page)
          .map(([field, placement]) => {
            const value = values[field];
            if (!value) return null;
            return <div key={field} className="schs-field-overlay" dir={placement.direction ?? 'ltr'} style={{
              left: `${placement.xPct}%`, top: `${placement.yPct}%`,
              width: `${placement.widthPct}%`, height: `${placement.heightPct}%`,
              fontSize: `${placement.fontSizePt}pt`,
            }}>{value}</div>;
          })}
      </article>)}
    </div>
  </>;
}
