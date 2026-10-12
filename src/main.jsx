import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { AuthProvider } from './context/AuthContext';
import { PreferencesProvider } from './context/PreferencesContext';
import { SavedPlacesProvider } from './context/SavedPlacesContext';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <SavedPlacesProvider>
        <PreferencesProvider>
          <App />
        </PreferencesProvider>
      </SavedPlacesProvider>
    </AuthProvider>
  </React.StrictMode>,
);
