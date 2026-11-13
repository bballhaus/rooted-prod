// What every AI feature shows when Claude couldn't answer (decision 0016):
// what happened, a retry, and the manual path where there is one. No
// scripted stand-in answer is ever shown in its place.
import { AI_ERROR_MESSAGE, type AiErrorCode } from '../agent/client';

const RETRYABLE = new Set<AiErrorCode>([
  'auth_unavailable',
  'provider_busy',
  'provider_timeout',
  'provider_unreachable',
  'provider_error',
  'refused',
  'too_long',
  'bad_output',
  'slack_error',
  'network',
  'unknown',
]);

export function AiErrorNotice({
  code,
  onRetry,
  children,
}: {
  code: AiErrorCode;
  onRetry?: () => void;
  children?: React.ReactNode; // the manual path, e.g. "Add an option yourself"
}) {
  return (
    <div className="banner ai-error stack" role="alert">
      <p>{AI_ERROR_MESSAGE[code]}</p>
      {(onRetry || children) && (
        <div className="row">
          {onRetry && RETRYABLE.has(code) && (
            <button type="button" className="btn btn-secondary" onClick={onRetry}>
              Try again
            </button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
