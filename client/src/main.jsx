import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.jsx";
import "./styles.css";

// Auto-register and update the PWA service worker safely
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.log("HerWell has an update available.");
  },
  onOfflineReady() {
    console.log("HerWell is ready for offline caching.");
  },
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
