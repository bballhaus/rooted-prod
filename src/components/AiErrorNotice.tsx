// What every AI feature shows when Claude couldn't answer (decision 0016):
// what happened, a retry, and the manual path where there is one. No
// scripted stand-in answer is ever shown in its place.
import { Link } from 'react-router-dom';
import { AI_ERROR_MESSAGE, isRetryable, type AiErrorCode } from '../agent/client';


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
      {(onRetry || children || code === 'sign_in_required') && (
        <div className="row">
          {code === 'sign_in_required' && (
            <Link to="/signin" className="btn btn-secondary">
              Sign in again
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
