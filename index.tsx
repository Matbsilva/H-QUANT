import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

// This is the entry point of the application.
// It finds the 'root' div in index.html and renders the main App component into it.

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
    console.error("Fatal error: The root element with ID 'root' was not found in the DOM. The React application could not be mounted.");
}