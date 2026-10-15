import "@fontsource/libre-baskerville/700.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RiskApp } from "./RiskApp.tsx";
import "./console.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RiskApp />
  </StrictMode>,
);
