import { StrictMode, useEffect } from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { DateRangeProvider } from './context/DateRangeContext';
import { Toaster } from 'sonner';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import './i18n';
import { applyTheme, getInitialTheme } from './lib/theme';

function ThemeBootstrap() {
  useEffect(() => {
    applyTheme(getInitialTheme());
  }, []);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeBootstrap />
    <AuthProvider>
      <BrowserRouter>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <DateRangeProvider>
            <App />
            <Toaster richColors position="top-center" />
          </DateRangeProvider>
        </LocalizationProvider>
      </BrowserRouter>
    </AuthProvider>
  </StrictMode>,
);
