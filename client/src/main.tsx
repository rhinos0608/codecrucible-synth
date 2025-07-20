import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Global unhandled promise rejection handler following AI_INSTRUCTIONS.md patterns
window.addEventListener('unhandledrejection', (event) => {
  // Following AI_INSTRUCTIONS.md: Log but don't prevent default for comprehensive error handling
  if (process.env.NODE_ENV === 'development') {
    console.log('Global unhandled promise rejection (handled):', {
      reason: event.reason,
      type: event.type,
      promise: event.promise
    });
  }
  
  // Prevent the default browser behavior (error logging)
  event.preventDefault();
});

// Global error handler for JavaScript errors
window.addEventListener('error', (event) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Global JavaScript error (handled):', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error
    });
  }
});

createRoot(document.getElementById("root")!).render(<App />);
