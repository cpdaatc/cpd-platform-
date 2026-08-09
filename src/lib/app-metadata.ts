export type AppMetadata = {
  name: string;
  locale: 'ar';
  direction: 'rtl';
  grantsScfhsAccreditation: false;
};

export function getAppMetadata(): AppMetadata {
  return {
    name: 'CPD Governance, Accreditation Readiness & Impact Intelligence Platform',
    locale: 'ar',
    direction: 'rtl',
    grantsScfhsAccreditation: false,
  };
}
