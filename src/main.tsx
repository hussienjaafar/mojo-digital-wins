import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

// Ensure users get the latest published version (avoids stale cached routes)
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Force activate the new service worker and reload
    updateSW(true);
  },
});

createRoot(document.getElementById("root")!).render(<App />);

