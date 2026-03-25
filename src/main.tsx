import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css"; // Main stylesheet loaded synchronously via import

createRoot(document.getElementById("root")!).render(<App />);
