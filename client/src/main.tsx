import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "@/app/app";
import { logInfo } from "@/utils/logger";
import "@/styles/globals.css";

logInfo("client", "Bootstrapping OKR Tracker UI");

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
