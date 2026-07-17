import { useState } from "react";
import { BrowserProvider } from "ethers";

export default function ConnectWallet() {
  const [address, setAddress] = useState("");

  async function connectWallet() {
    if (!window.ethereum) {
      alert("MetaMask not found");
      return;
    }

    try {
      const provider = new BrowserProvider(window.ethereum);

      await provider.send("eth_requestAccounts", []);

      const signer = await provider.getSigner();

      const addr = await signer.getAddress();

      setAddress(addr);
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div>
      <button onClick={connectWallet}>
        Connect MetaMask
      </button>

      {address && (
        <p>Address: {address}</p>
      )}
    </div>
  );
}