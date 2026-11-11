import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles.css";

const BASE = import.meta.env.BASE_URL;

// Links shared before the move to real URLs look like /lalaflow/#/san-pham/85; keep them working.
if (window.location.hash.startsWith("#/")) {
  window.history.replaceState(null, "", `${BASE}${window.location.hash.slice(2)}`);
}

// Installing to the home screen needs a service worker. Skipped in `vite dev`, where it would intercept the dev server.
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker
    .register(`${BASE}sw.js`, { scope: BASE })
    .catch((error) => console.error(`Service worker registration failed: ${error.message}`));
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={BASE.replace(/\/$/, "")}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
