import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Offline app loading. Registered only in the real build, never in development,
// and only after the page has loaded so it cannot slow the first paint. If it
// fails, the app carries on exactly as before.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is a bonus, never a requirement */
    });
  });
}
