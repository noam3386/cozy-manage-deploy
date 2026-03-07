import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "./i18n";

// Register push notification service worker as early as possible
// This ensures it's active even when the app is closed
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw-push.js', { scope: '/' })
    .then((registration) => {
      console.log('[SW] Push Service Worker registered:', registration.scope);
      
      // Keep the service worker updated
      registration.update();
    })
    .catch((error) => {
      console.error('[SW] Push Service Worker registration failed:', error);
    });
}

createRoot(document.getElementById("root")!).render(<App />);
