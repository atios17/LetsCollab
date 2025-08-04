// index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Import the global CSS
import App from './App'; // Import your main App component

// Get the root element from index.html
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render the App component into the root
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
