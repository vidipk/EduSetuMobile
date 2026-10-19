import { normalizeApiError } from '@/api/client/error';
import { describeError, type ErrorPresentation } from '@/features/performance/format';

/**
 * AI errors keep the backend message for policy and quota responses (disabled by the school, daily or
 * monthly limit, provider unavailable, session conflict) because those messages tell the student what
 * to do next. Everything else uses the shared safe messages.
 */
export function describeAiError(error: unknown): ErrorPresentation & { code?: string } {
  const normalized = normalizeApiError(error);
  const status = normalized.status;
  const base = describeError(error);
  const message = normalized.message.trim();
  const informative = message && !/^[{[]/.test(message) && message !== 'Forbidden' && message !== 'Unauthorized';
  if ((status === 403 || status === 409 || status === 429 || status === 503) && informative) {
    return { ...base, message, code: normalized.code };
  }
  return { ...base, code: normalized.code };
}
