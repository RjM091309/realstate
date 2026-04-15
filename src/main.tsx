import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { DateRangeProvider } from './context/DateRangeContext';
import { Toaster } from 'sonner';
import './index.css';
import './i18n';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <DateRangeProvider>
        <App />
        <Toaster richColors position="top-center" />
      </DateRangeProvider>
    </AuthProvider>
  </StrictMode>,
);
