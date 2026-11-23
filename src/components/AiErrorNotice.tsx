// What every AI feature shows when Claude couldn't answer (decision 0016):
// what happened, a retry, and the manual path where there is one. No
// scripted stand-in answer is ever shown in its place.
import { Link } from 'react-router-dom';
import { AI_ERROR_MESSAGE, isRetryable, type AiErrorCode } from '../agent/client';

// Errors the PM fixes by choosing what Rooted can read.
const SOURCE_FIX = new Set<AiErrorCode>(['nothing_to_read', 'no_channels', 'slack_not_connected']);

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
      {(onRetry || children || code === 'sign_in_required' || SOURCE_FIX.has(code)) && (
        <div className="row">
          {code === 'sign_in_required' && (
            <Link to="/signin" className="btn btn-secondary">
              Sign in again
            </Link>
          )}
          {SOURCE_FIX.has(code) && (
            <Link to="/settings#settings-sources" className="btn btn-secondary">
              Choose sources in Settings
            </Link>
          )}
          {onRetry && isRetryable(code) && (
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
