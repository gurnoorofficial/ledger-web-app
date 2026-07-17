import { useState } from "react";
import TransportWebHID from "@ledgerhq/hw-transport-webhid";
import Eth from "@ledgerhq/hw-app-eth";

const DERIVATION_PATH = "44'/60'/0'/0/0";

export default function App() {
  const [status, setStatus] = useState("Ready");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");

  async function connectLedger() {
    let transport;

    try {
      setStatus("Connecting...");
      setError("");
      setAddress("");

      if (!("hid" in navigator)) {
        throw new Error("WebHID is not supported in this browser.");
      }

      transport = await TransportWebHID.create();

      const eth = new Eth(transport);

      const result = await eth.getAddress(
        DERIVATION_PATH,
        true,
        false
      );

      setAddress(result.address);
      setStatus("Address received");
    } catch (err) {
      console.error(err);
      setStatus("Failed");
      setError(err?.message || String(err));
    } finally {
      if (transport) {
        await transport.close().catch(console.error);
      }
    }
  }

  return (
    <div style={{ padding: "40px", fontFamily: "Arial" }}>
      <h1>Ledger Ethereum Address</h1>

      <p>Unlock Ledger and open the Ethereum app.</p>

      <button onClick={connectLedger}>
        Connect Ledger
      </button>

      <p>Status: {status}</p>

      {address && (
        <p>
          Address: <code>{address}</code>
        </p>
      )}

      {error && (
        <pre style={{ whiteSpace: "pre-wrap" }}>
          Error: {error}
        </pre>
      )}
    </div>
  );
}