import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { BildirimProvider } from './contexts/BildirimContext';
import { CompanyProvider } from './contexts/CompanyContext';
import { OfflineIndicator } from './components/OfflineIndicator';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root elementi bulunamadı');

createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <CompanyProvider>
          <NotificationProvider>
            <BildirimProvider>
              <Toaster 
                position="top-right"
                toastOptions={{
                  duration: 4000,
                  style: {
                    background: '#333',
                    color: '#fff',
                  },
                  success: {
                    duration: 3000,
                    iconTheme: {
                      primary: '#22c55e',
                      secondary: '#fff',
                    },
                  },
                  error: {
                    duration: 5000,
                    iconTheme: {
                      primary: '#ef4444',
                      secondary: '#fff',
                    },
                  },
                }}
              />
              <OfflineIndicator />
              <App />
            </BildirimProvider>
          </NotificationProvider>
        </CompanyProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);