export type DiagnosticOutcome = 'success' | 'failure' | 'blocked' | 'warning';

export type SafeDiagnosticInput = {
  operation: string;
  outcome: DiagnosticOutcome;
  requestId?: string | null;
  organizationId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  status?: string | null;
  errorCode?: string | null;
};

export type SafeDiagnosticEvent = SafeDiagnosticInput & { timestamp: string };

const allowedFields = new Set([
  'operation','outcome','requestId','organizationId','entityType','entityId','status','errorCode',
]);
const forbiddenPattern = /password|token|authorization|cookie|email|phone|mobile|name|raw|evidence|payload|document|content|secret|key|signature|identity|national/i;

function assertSafeShape(input: SafeDiagnosticInput): void {
  for (const key of Object.keys(input as Record<string, unknown>)) {
    if (!allowedFields.has(key) || forbiddenPattern.test(key)) {
      throw new Error(`Forbidden diagnostic field: ${key}`);
    }
    const value = (input as Record<string, unknown>)[key];
    if (value !== null && value !== undefined && typeof value !== 'string') {
      throw new Error(`Diagnostic field ${key} must be a scalar string.`);
    }
  }
  if (!input.operation?.trim()) throw new Error('Diagnostic operation is required.');
  if (!['success','failure','blocked','warning'].includes(input.outcome)) throw new Error('Diagnostic outcome is invalid.');
}

export function buildSafeDiagnosticEvent(input: SafeDiagnosticInput): SafeDiagnosticEvent {
  assertSafeShape(input);
  return { ...input, timestamp: new Date().toISOString() };
}

export function safeDiagnosticLog(input: SafeDiagnosticInput, _error?: unknown): SafeDiagnosticEvent {
  const event = buildSafeDiagnosticEvent(input);
  const serialized = JSON.stringify(event);
  if (input.outcome === 'failure' || input.outcome === 'blocked') console.error(serialized);
  else if (input.outcome === 'warning') console.warn(serialized);
  else console.info(serialized);
  return event;
}
