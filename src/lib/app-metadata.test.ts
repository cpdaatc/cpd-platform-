import { describe, expect, it } from 'vitest';
import { getAppMetadata } from './app-metadata';

describe('getAppMetadata', () => {
  it('exposes the governance-safe product identity', () => {
    expect(getAppMetadata()).toEqual({
      name: 'CPD Governance, Accreditation Readiness & Impact Intelligence Platform',
      locale: 'ar',
      direction: 'rtl',
      grantsScfhsAccreditation: false,
    });
  });
});
