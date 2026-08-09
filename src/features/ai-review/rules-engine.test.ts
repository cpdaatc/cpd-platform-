import { describe, expect, it } from 'vitest';
import {
  classifyLearningDomain,
  reviewObjectiveMethodEvaluationAlignment,
  runDeterministicPreReview,
  reviewObjective,
  sanitizeAiPayload,
  type PreReviewInput,
} from './rules-engine';

describe('Phase 3 deterministic readiness engine', () => {
  it('flags an activity scientific committee with fewer than two members', () => {
    const findings = runDeterministicPreReview({
      committeeMemberCount: 1,
      learningGap: 'A documented gap',
      objectives: ['Apply the protocol accurately'],
      learningMethods: 'Simulation and guided practice',
      evaluationMethod: 'Observed performance checklist',
      speakerCount: 1,
      speakerCvCount: 1,
      disclosureStatuses: ['DECLARED_NO_CONFLICT'],
    });
    expect(findings.some((f) => f.ruleCode === 'ACT-GOV-001' && f.status === 'MISSING_REQUIRED_INFORMATION')).toBe(true);
  });

  it('does not invent missing objectives or targets', () => {
    const findings = runDeterministicPreReview({
      committeeMemberCount: 2,
      learningGap: '',
      objectives: [],
      learningMethods: '',
      evaluationMethod: '',
      speakerCount: 0,
      speakerCvCount: 0,
      disclosureStatuses: [],
    });
    expect(findings.some((f) => f.status === 'MISSING_REQUIRED_INFORMATION')).toBe(true);
    expect(findings.every((f) => !f.recommendation.includes('85%'))).toBe(true);
  });

  it('flags weak non-measurable Bloom verbs as needs improvement', () => {
    const result = reviewObjective('Understand medication safety principles');
    expect(result.status).toBe('NEEDS_IMPROVEMENT');
    expect(result.weakVerbs).toContain('understand');
  });

  it('accepts a measurable objective without claiming SCFHS approval', () => {
    const result = reviewObjective('Demonstrate correct hand hygiene technique using the approved checklist');
    expect(result.status).toBe('ALIGNED');
    expect(result.message.toLowerCase()).not.toContain('scfhs approved');
    expect(result.message.toLowerCase()).not.toContain('compliance score');
  });

  it('classifies clear learning domains conservatively', () => {
    expect(classifyLearningDomain('Demonstrate correct airway positioning')).toBe('SKILL');
    expect(classifyLearningDomain('Explain the causes of medication error')).toBe('KNOWLEDGE');
    expect(classifyLearningDomain('Advocate for transparent safety reporting')).toBe('ATTITUDE');
    expect(classifyLearningDomain('Improve patient care')).toBe('HUMAN_REVIEW_REQUIRED');
  });

  it('flags a skill objective paired only with lecture and satisfaction survey', () => {
    const result = reviewObjectiveMethodEvaluationAlignment(
      'Demonstrate correct hand hygiene technique',
      'Lecture presentation',
      'Participant satisfaction survey',
    );
    expect(result.domain).toBe('SKILL');
    expect(result.status).toBe('NEEDS_IMPROVEMENT');
  });

  it('recognizes a plausible skill alignment but keeps it advisory', () => {
    const result = reviewObjectiveMethodEvaluationAlignment(
      'Demonstrate correct hand hygiene technique',
      'Simulation and hands-on practice',
      'Observed performance checklist',
    );
    expect(result.status).toBe('ALIGNED');
    expect(result.message).toMatch(/بشرية|human/i);
  });

  it('redacts contact and identity-like fields before external AI payload', () => {
    const sanitized = sanitizeAiPayload({
      fullName: 'Demo Speaker',
      email: 'speaker@example.test',
      mobile: '+966500000000',
      nationalId: '1234567890',
      learningGap: 'Practice gap',
      objective: 'Apply protocol',
    });
    expect(sanitized.email).toBe('[REDACTED]');
    expect(sanitized.mobile).toBe('[REDACTED]');
    expect(sanitized.nationalId).toBe('[REDACTED]');
    expect(sanitized.learningGap).toBe('Practice gap');
  });

  it('keeps the pre-review input type explicit', () => {
    const input: PreReviewInput = {
      committeeMemberCount: 2,
      learningGap: 'gap',
      objectives: ['Apply protocol'],
      learningMethods: 'case discussion',
      evaluationMethod: 'case assessment',
      speakerCount: 1,
      speakerCvCount: 1,
      disclosureStatuses: ['DECLARED_NO_CONFLICT'],
    };
    expect(input.committeeMemberCount).toBe(2);
  });
});
