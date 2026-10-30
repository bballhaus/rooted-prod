import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import './layout.css';

export function Layout() {
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container site-header-inner">
          <NavLink to="/" className="wordmark" aria-label="Rooted home">
            Rooted
          </NavLink>
          <nav aria-label="Main" className="site-nav">
            <NavLink to="/" end>
              Decisions
            </NavLink>
            <NavLink to="/decisions/new">New decision</NavLink>
            <NavLink to="/settings">Settings</NavLink>
            <NavLink to="/help">Help</NavLink>
          </nav>
          {state.user && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                dispatch({ type: 'signOut' });
                navigate('/signin');
              }}
            >
              Sign out
            </button>
          )}
        </div>
      </header>
      <main id="main" className="container">
        <Outlet />
      </main>
    </>
  );
}
