import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import { ThemeProvider } from './lib/theme';
import { ToastProvider } from './lib/toast';
import { installDevMock } from './lib/devmock';
import App from './App';

installDevMock();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
