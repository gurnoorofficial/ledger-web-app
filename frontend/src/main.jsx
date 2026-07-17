import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Buffer } from "buffer";
import "./index.css";

globalThis.Buffer = Buffer;

async function startApp() {
  const { default: App } = await import("./App.jsx");

  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}

startApp().catch((error) => {
  console.error("Application failed to start:", error);
});