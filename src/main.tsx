import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./pwa";
import "./theme";
import "@fontsource-variable/newsreader/opsz.css";
import "./viewport";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
