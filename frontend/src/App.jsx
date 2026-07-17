import { useState } from "react";
import "./App.css";

function App() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function contactBackend() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("http://localhost:3000/api/hello");

      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }

      const data = await response.json();
      setMessage(data.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <h1>Ledger Web App</h1>
      <p>React frontend with Node.js backend</p>

      <button onClick={contactBackend} disabled={loading}>
        {loading ? "Connecting..." : "Contact Backend"}
      </button>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">Error: {error}</p>}
    </main>
  );
}

export default App;