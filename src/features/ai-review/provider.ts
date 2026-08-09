import { sanitizeAiPayload } from './rules-engine';

export type AiProviderRequest = {
  purpose: 'PLANNING_ASSISTANT' | 'PRE_REVIEW';
  payload: Record<string, unknown>;
};

export type AiProviderResponse = {
  text: string;
  model: string;
  provider: string;
};

export type OrganizationAiPolicy = {
  externalAiEnabled: boolean;
  privacyApproved: boolean;
  provider: string | null;
  processingRegion: string | null;
};

export interface AiProvider {
  execute(request: AiProviderRequest): Promise<AiProviderResponse>;
}

export class DisabledAiProvider implements AiProvider {
  async execute(): Promise<AiProviderResponse> {
    throw new Error('External AI is disabled by organization privacy policy.');
  }
}

export function assertExternalAiAllowed(policy: OrganizationAiPolicy): void {
  if (!policy.externalAiEnabled || !policy.privacyApproved) {
    throw new Error('External AI is disabled until privacy approval is explicitly recorded.');
  }
  if (!policy.provider || !policy.processingRegion) {
    throw new Error('External AI provider and processing region must be configured before use.');
  }
}

export function prepareExternalAiRequest(
  request: AiProviderRequest,
  policy: OrganizationAiPolicy,
): AiProviderRequest {
  assertExternalAiAllowed(policy);
  return {
    ...request,
    payload: sanitizeAiPayload(request.payload),
  };
}
