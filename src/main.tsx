// Global tokens and base styles load first, so feature styles can refine them.
import './styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AiProvider } from './agent/AiContext';
import { AuthProvider } from './auth/AuthContext';
import { StoreProvider } from './store/store';
import { applyStoredTheme } from './theme';

// Set the theme before first paint so there's no flash.
applyStoredTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <AuthProvider>
        <AiProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AiProvider>
      </AuthProvider>
    </StoreProvider>
  </StrictMode>,
);
