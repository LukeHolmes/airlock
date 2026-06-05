/**
 * Airlock Renderer Entry Point
 *
 * React application entry. Loads AirlockApp component.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import AirlockApp from './AirlockApp';

// Check for IPC availability
if (typeof window !== 'undefined' && !window.airlock) {
  console.warn('[renderer] Airlock IPC API not found — running in mock mode');
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AirlockApp />
  </React.StrictMode>,
);
