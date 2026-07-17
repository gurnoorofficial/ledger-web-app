import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Buffer } from "buffer";
import "./index.css";

globalThis.Buffer = Buffer;

async function startApp() {
  await import("./appkit.js");

  const { default: App } = await import("./App.jsx");

  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

startApp().catch((error) => {
  console.error("Application failed to start:", error);

  const root = document.getElementById("root");

  if (root) {
    root.innerHTML = `
      <div style="padding: 24px; font-family: sans-serif;">
        <h2>Application failed to start</h2>
        <pre style="white-space: pre-wrap;">${String(
          error?.message || error
        )}</pre>
      </div>
    `;
  }
});