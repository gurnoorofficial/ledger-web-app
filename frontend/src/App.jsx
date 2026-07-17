import { useEffect, useMemo, useState } from "react";
import TransportWebHID from "@ledgerhq/hw-transport-webhid";
import Eth from "@ledgerhq/hw-app-eth";
import {
  useAppKit,
  useAppKitAccount,
  useAppKitProvider,
} from "@reown/appkit/react";
import {
  BrowserProvider,
  Signature,
  verifyMessage,
} from "ethers";
import "./App.css";

const DEFAULT_PATH = "44'/60'/0'/0/0";

function normalizeDerivationPath(value) {
  return value.trim().replace(/^m\//i, "");
}

function validateDerivationPath(value) {
  const normalizedPath = normalizeDerivationPath(value);

  if (!normalizedPath) {
    throw new Error("Derivation path is required.");
  }

  const validPathPattern = /^\d+'?(\/\d+'?)*$/;

  if (!validPathPattern.test(normalizedPath)) {
    throw new Error(
      "Invalid derivation path. Example: 44'/60'/0'/0/0"
    );
  }

  return normalizedPath;
}

function utf8ToHex(message) {
  const bytes = new TextEncoder().encode(message);

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function ensureHexPrefix(value) {
  if (!value) {
    return "";
  }

  return value.startsWith("0x") ? value : `0x${value}`;
}

function getUtcTimestamp() {
  return new Date().toISOString().split(".")[0];
}

function formatWalletError(error) {
  const message =
    error instanceof Error ? error.message : String(error);

  const lowercaseMessage = message.toLowerCase();

  if (
    lowercaseMessage.includes("user rejected") ||
    lowercaseMessage.includes("user denied") ||
    lowercaseMessage.includes("4001")
  ) {
    return "The request was rejected in the wallet.";
  }

  if (
    lowercaseMessage.includes("no device selected") ||
    lowercaseMessage.includes("access denied")
  ) {
    return "Ledger connection was cancelled or browser permission was denied.";
  }

  if (lowercaseMessage.includes("already open")) {
    return (
      "Ledger is already being used. Close Ledger Live, wallet apps, " +
      "other browser tabs, and previous Ledger scripts."
    );
  }

  if (
    lowercaseMessage.includes("0x6e00") ||
    lowercaseMessage.includes("cla not supported")
  ) {
    return "Open the Ethereum app on your Ledger device.";
  }

  if (
    lowercaseMessage.includes("0x6985") ||
    lowercaseMessage.includes("denied by the user") ||
    lowercaseMessage.includes("condition of use not satisfied")
  ) {
    return "The request was rejected on the Ledger device.";
  }

  if (
    lowercaseMessage.includes("webhid") ||
    lowercaseMessage.includes("navigator.hid")
  ) {
    return "WebHID is unavailable. Use Chrome or Edge through localhost on a desktop computer.";
  }

  return message;
}

async function withLedger(callback) {
  let transport;

  try {
    transport = await TransportWebHID.create();

    const eth = new Eth(transport);

    return await callback(eth);
  } finally {
    if (transport) {
      try {
        await transport.close();
      } catch {
        // Ignore transport cleanup errors.
      }
    }
  }
}

function CopyButton({ value, label = "Copy" }) {
  const [copied, setCopied] = useState(false);

  async function copyValue() {
    if (!value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      className="copy-button"
      type="button"
      onClick={copyValue}
      disabled={!value}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function OutputField({
  label,
  value,
  mono = true,
  large = false,
}) {
  return (
    <div
      className={`output-field ${
        large ? "output-field-large" : ""
      }`}
    >
      <div className="output-header">
        <span>{label}</span>
        <CopyButton value={value} />
      </div>

      <div
        className={
          mono ? "output-value mono" : "output-value"
        }
      >
        {value || "Not available"}
      </div>
    </div>
  );
}

function App() {
  const webHidSupported = useMemo(
    () =>
      typeof navigator !== "undefined" &&
      "hid" in navigator,
    []
  );

  const { open } = useAppKit();
  const {
    address: appKitAddress,
    isConnected: appKitConnected,
  } = useAppKitAccount({ namespace: "eip155" });
  const { walletProvider } =
    useAppKitProvider("eip155");

  const [walletMode, setWalletMode] = useState("");
  const [ledgerConnected, setLedgerConnected] =
    useState(false);

  const [derivationPath, setDerivationPath] =
    useState(DEFAULT_PATH);

  const [address, setAddress] = useState("");
  const [publicKey, setPublicKey] = useState("");

  const [message, setMessage] = useState(
    "Hello from my Ledger Nano X"
  );

  const [timestampMode, setTimestampMode] =
    useState("ASK");

  const [includeTimestampAsk, setIncludeTimestampAsk] =
    useState(false);

  const [signature, setSignature] = useState("");
  const [signatureR, setSignatureR] = useState("");
  const [signatureS, setSignatureS] = useState("");
  const [signatureV, setSignatureV] = useState("");

  const [originalSignedMessage, setOriginalSignedMessage] =
    useState("");

  const [exactSignedMessage, setExactSignedMessage] =
    useState("");

  const [signedTimestamp, setSignedTimestamp] =
    useState("");

  const [signedDerivationPath, setSignedDerivationPath] =
    useState("");

  const [signingAddress, setSigningAddress] =
    useState("");

  const [recoveredAddress, setRecoveredAddress] =
    useState("");

  const [signatureValid, setSignatureValid] =
    useState(null);

  const [status, setStatus] = useState("Ready");
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState("");

  const isBusy = Boolean(busyAction);
  const walletConnected =
    Boolean(appKitConnected && appKitAddress);
  const usingAppKit =
    walletMode === "appkit" && walletConnected;
  const usingLedger =
    walletMode === "ledger" && ledgerConnected;


  useEffect(() => {
    if (appKitConnected && appKitAddress) {
      if (walletMode !== "ledger") {
        setWalletMode("appkit");
        setLedgerConnected(false);
        setAddress(appKitAddress);
        setPublicKey("");
        setStatus("Wallet connected through Reown AppKit");
      }

      return;
    }

    if (walletMode === "appkit") {
      setWalletMode("");
      setAddress("");
      setPublicKey("");
      clearSignatureResults();
      setStatus("Wallet disconnected");
    }
  }, [appKitAddress, appKitConnected, walletMode]);

  function clearSignatureResults() {
    setSignature("");
    setSignatureR("");
    setSignatureS("");
    setSignatureV("");

    setOriginalSignedMessage("");
    setExactSignedMessage("");
    setSignedTimestamp("");
    setSignedDerivationPath("");

    setSigningAddress("");
    setRecoveredAddress("");
    setSignatureValid(null);
  }

  function prepareMessageForSigning() {
    const rawMessage = message.trim();

    if (!rawMessage) {
      throw new Error("The message cannot be empty.");
    }

    let shouldAddTimestamp = false;

    if (timestampMode === "ALWAYS") {
      shouldAddTimestamp = true;
    }

    if (timestampMode === "ASK") {
      shouldAddTimestamp = includeTimestampAsk;
    }

    let timestamp = "";
    let fullMessage = rawMessage;

    if (shouldAddTimestamp) {
      timestamp = getUtcTimestamp();
      fullMessage = `${rawMessage} ${timestamp}`;
    }

    return {
      rawMessage,
      timestamp,
      fullMessage,
    };
  }

  async function connectWallet() {
    setError("");
    setBusyAction("connect-wallet");
    setStatus("Opening wallet connection...");

    try {
      await open();

      setStatus(
        appKitConnected
          ? "Wallet connected through Reown AppKit"
          : "Select a wallet in the connection window"
      );
    } catch (walletError) {
      setStatus("Failed");
      setError(formatWalletError(walletError));
    } finally {
      setBusyAction("");
    }
  }


  async function connectLedger() {
    setError("");
    setBusyAction("connect-ledger");
    setStatus("Connecting to Ledger...");

    try {
      if (!webHidSupported) {
        throw new Error(
          "Ledger WebHID requires desktop Chrome or Edge through localhost or HTTPS."
        );
      }

      const path =
        validateDerivationPath(derivationPath);

      const account = await withLedger((eth) =>
        eth.getAddress(path, false, false)
      );

      setWalletMode("ledger");
      setLedgerConnected(true);
      setAddress(account.address);
      setPublicKey(
        ensureHexPrefix(account.publicKey)
      );
      clearSignatureResults();

      setStatus("Ledger connected and selected");
    } catch (walletError) {
      setLedgerConnected(false);
      setStatus("Failed");
      setError(formatWalletError(walletError));
    } finally {
      setBusyAction("");
    }
  }

  async function getAccount(showOnDevice) {
    setError("");

    setBusyAction(
      showOnDevice ? "verify-address" : "get-address"
    );

    try {
      if (usingAppKit && !showOnDevice) {
        if (!walletProvider) {
          throw new Error(
            "The connected wallet provider is unavailable. Reconnect the wallet."
          );
        }

        setStatus(
          "Reading Ethereum address from the connected wallet..."
        );

        const provider = new BrowserProvider(
          walletProvider
        );

        const signer = await provider.getSigner();
        const accountAddress =
          await signer.getAddress();

        setAddress(accountAddress);

        // Standard browser wallets do not expose the account
        // public key through eth_requestAccounts/getSigner.
        setPublicKey("");

        setStatus(
          "Connected wallet Ethereum address received"
        );

        return;
      }

      if (!usingLedger) {
        throw new Error(
          "Choose and connect a wallet or Ledger first."
        );
      }

      if (!webHidSupported) {
        throw new Error(
          "WebHID is not supported. Use Chrome or Edge through localhost on a desktop computer."
        );
      }

      setStatus(
        showOnDevice
          ? "Waiting for address confirmation on Ledger..."
          : "Connecting to Ledger..."
      );

      const path =
        validateDerivationPath(derivationPath);

      const account = await withLedger((eth) =>
        eth.getAddress(path, showOnDevice, false)
      );

      setAddress(account.address);
      setPublicKey(
        ensureHexPrefix(account.publicKey)
      );

      setStatus(
        showOnDevice
          ? "Address verified on Ledger"
          : "Address and public key received"
      );
    } catch (walletError) {
      setStatus("Failed");
      setError(formatWalletError(walletError));
    } finally {
      setBusyAction("");
    }
  }

  async function signMessage() {
    setError("");
    clearSignatureResults();

    setBusyAction("sign-message");

    try {
      const {
        rawMessage,
        timestamp,
        fullMessage,
      } = prepareMessageForSigning();

      if (usingAppKit) {
        if (!walletProvider) {
          throw new Error(
            "The connected wallet provider is unavailable. Reconnect the wallet."
          );
        }

        setStatus(
          "Waiting for wallet signature approval..."
        );

        const provider = new BrowserProvider(
          walletProvider
        );

        const signer = await provider.getSigner();
        const signerAddress =
          await signer.getAddress();

        const walletSignature =
          await signer.signMessage(fullMessage);

        const parsedSignature =
          Signature.from(walletSignature);

        const recovered = verifyMessage(
          fullMessage,
          walletSignature
        );

        const isValid =
          recovered.toLowerCase() ===
          signerAddress.toLowerCase();

        setAddress(signerAddress);
        setPublicKey("");

        setSignature(walletSignature);
        setSignatureR(parsedSignature.r);
        setSignatureS(parsedSignature.s);
        setSignatureV(
          String(parsedSignature.v)
        );

        setOriginalSignedMessage(rawMessage);
        setExactSignedMessage(fullMessage);
        setSignedTimestamp(timestamp);
        setSignedDerivationPath(
          "Reown AppKit connected account"
        );

        setSigningAddress(signerAddress);
        setRecoveredAddress(recovered);
        setSignatureValid(isValid);

        setStatus(
          isValid
            ? "Wallet message signed and verified successfully"
            : "Wallet signature created, but verification failed"
        );

        return;
      }

      if (!webHidSupported) {
        throw new Error(
          "WebHID is not supported. Use Chrome or Edge through localhost on a desktop computer."
        );
      }

      setStatus(
        "Preparing message for Ledger..."
      );

      const path =
        validateDerivationPath(derivationPath);

      const messageHex = utf8ToHex(fullMessage);

      setStatus(
        "Connect Ledger and confirm the Ethereum address..."
      );

      const signingResult = await withLedger(
        async (eth) => {
          const account = await eth.getAddress(
            path,
            true,
            false
          );

          setStatus(
            "Address confirmed. Review and approve the message on Ledger..."
          );

          const ledgerSignature =
            await eth.signPersonalMessage(
              path,
              messageHex
            );

          return {
            account,
            ledgerSignature,
          };
        }
      );

      const { account, ledgerSignature } =
        signingResult;

      const numericV =
        typeof ledgerSignature.v === "string"
          ? Number.parseInt(
              ledgerSignature.v,
              16
            )
          : Number(ledgerSignature.v);

      if (!Number.isFinite(numericV)) {
        throw new Error(
          "Ledger returned an invalid signature recovery value."
        );
      }

      const normalizedV =
        numericV === 0 || numericV === 1
          ? numericV + 27
          : numericV;

      const ethersSignature = Signature.from({
        r: ensureHexPrefix(ledgerSignature.r),
        s: ensureHexPrefix(ledgerSignature.s),
        v: normalizedV,
      });

      const serializedSignature =
        ethersSignature.serialized;

      const recovered = verifyMessage(
        fullMessage,
        serializedSignature
      );

      const isValid =
        recovered.toLowerCase() ===
        account.address.toLowerCase();

      setAddress(account.address);
      setPublicKey(
        ensureHexPrefix(account.publicKey)
      );

      setSignature(serializedSignature);
      setSignatureR(ethersSignature.r);
      setSignatureS(ethersSignature.s);
      setSignatureV(
        String(ethersSignature.v)
      );

      setOriginalSignedMessage(rawMessage);
      setExactSignedMessage(fullMessage);
      setSignedTimestamp(timestamp);
      setSignedDerivationPath(`m/${path}`);

      setSigningAddress(account.address);
      setRecoveredAddress(recovered);
      setSignatureValid(isValid);

      setStatus(
        isValid
          ? "Ledger message signed and verified successfully"
          : "Ledger signature created, but verification failed"
      );
    } catch (walletError) {
      setStatus("Failed");
      setError(formatWalletError(walletError));
    } finally {
      setBusyAction("");
    }
  }

  function clearResults() {
    setAddress("");
    setPublicKey("");
    clearSignatureResults();

    setStatus("Ready");
    setError("");
  }

  return (
    <main className="app-shell">
      <div className="background-glow glow-one" />
      <div className="background-glow glow-two" />

      <section className="hero">
        <div className="brand-row">
          <div className="brand-mark">L</div>

          <div>
            <div className="eyebrow">
              Ledger and WalletConnect Toolkit
            </div>

            <h1>Ethereum Wallet Toolkit</h1>
          </div>
        </div>

        <p className="hero-description">
          Read Ethereum accounts and sign personal messages
          using Reown AppKit wallets or your Ledger Nano X.
        </p>

        <div className="button-row">
          <button
            className="primary-button"
            type="button"
            onClick={connectWallet}
            disabled={isBusy}
          >
            {busyAction === "connect-wallet"
              ? "Connecting..."
              : usingAppKit
                ? "Wallet Selected"
                : walletConnected
                  ? "Manage Wallet"
                  : "Connect Wallet"}
          </button>

          <button
            className="secondary-button"
            type="button"
            onClick={connectLedger}
            disabled={isBusy || !webHidSupported}
          >
            {busyAction === "connect-ledger"
              ? "Connecting..."
              : usingLedger
                ? "Ledger Selected"
                : "Connect Ledger"}
          </button>
        </div>

        {usingAppKit && (
          <p style={{ marginTop: "10px" }}>
            {appKitAddress}
          </p>
        )}

        <div className="security-strip">
          <span className="security-dot" />

          {usingAppKit
            ? "Active wallet: Reown AppKit"
            : usingLedger
              ? "Active wallet: Ledger"
              : "Choose a wallet or Ledger"}
        </div>
      </section>

      {!webHidSupported && (
        <div className="alert alert-error">
          WebHID is unavailable for Ledger. Connect a wallet,
          or open this website through localhost in Chrome or
          Edge on a desktop computer.
        </div>
      )}

      <section className="status-card">
        <div>
          <span className="status-label">
            Wallet status
          </span>

          <strong>{status}</strong>
        </div>

        <div
          className={`status-indicator ${
            error
              ? "status-error"
              : isBusy
                ? "status-working"
                : ""
          }`}
        />
      </section>

      {error && (
        <div className="alert alert-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      <section className="workspace-grid">
        <article className="tool-card">
          <div className="card-number">01</div>

          <div className="card-heading">
            <div>
              <h2>Ethereum account</h2>

              <p>
                Read the connected wallet address or read an
                address and public key from Ledger.
              </p>
            </div>
          </div>

          <label
            className="field-label"
            htmlFor="derivation-path"
          >
            Ledger derivation path
          </label>

          <div className="path-input">
            <span>m/</span>

            <input
              id="derivation-path"
              type="text"
              value={derivationPath}
              onChange={(event) =>
                setDerivationPath(
                  event.target.value
                )
              }
              placeholder="44'/60'/0'/0/0"
              spellCheck="false"
              autoComplete="off"
              disabled={isBusy}
            />
          </div>

          <p className="field-help">
            Used only for Ledger:
            {" "}
            m/44&apos;/60&apos;/0&apos;/0/0
          </p>

          <div className="button-row">
            <button
              className="primary-button"
              type="button"
              onClick={() => getAccount(false)}
              disabled={
                isBusy ||
                (!usingAppKit && !usingLedger)
              }
            >
              {busyAction === "get-address"
                ? "Connecting..."
                : usingAppKit
                  ? "Get wallet address"
                  : "Get address & public key"}
            </button>

            <button
              className="secondary-button"
              type="button"
              onClick={() => getAccount(true)}
              disabled={
                isBusy || !usingLedger || !webHidSupported
              }
            >
              {busyAction === "verify-address"
                ? "Waiting..."
                : "Verify on Ledger"}
            </button>
          </div>

          <div className="results">
            <OutputField
              label="Ethereum address"
              value={address}
            />

            <OutputField
              label={
                usingAppKit
                  ? "Public key (not exposed by browser wallets)"
                  : "Public key"
              }
              value={publicKey}
            />
          </div>
        </article>

        <article className="tool-card">
          <div className="card-number">02</div>

          <div className="card-heading">
            <div>
              <h2>Sign personal message</h2>

              <p>
                Sign exact UTF-8 text using a connected wallet or the
                selected Ledger derivation path, then verify
                the recovered Ethereum address.
              </p>
            </div>
          </div>

          <div className="timestamp-controls">
            <div>
              <label
                className="field-label"
                htmlFor="timestamp-mode"
              >
                Timestamp mode
              </label>

              <select
                id="timestamp-mode"
                value={timestampMode}
                onChange={(event) =>
                  setTimestampMode(
                    event.target.value
                  )
                }
                disabled={isBusy}
              >
                <option value="ASK">ASK</option>
                <option value="ALWAYS">
                  ALWAYS
                </option>
                <option value="NEVER">
                  NEVER
                </option>
              </select>
            </div>

            {timestampMode === "ASK" && (
              <label className="timestamp-checkbox">
                <input
                  type="checkbox"
                  checked={includeTimestampAsk}
                  onChange={(event) =>
                    setIncludeTimestampAsk(
                      event.target.checked
                    )
                  }
                  disabled={isBusy}
                />

                <span>
                  Include a UTC timestamp in this signature
                </span>
              </label>
            )}

            {timestampMode === "ALWAYS" && (
              <div className="timestamp-mode-note">
                A UTC timestamp will automatically be added.
              </div>
            )}

            {timestampMode === "NEVER" && (
              <div className="timestamp-mode-note">
                The message will be signed without a timestamp.
              </div>
            )}
          </div>

          <label
            className="field-label"
            htmlFor="message"
          >
            Message
          </label>

          <textarea
            id="message"
            value={message}
            onChange={(event) =>
              setMessage(event.target.value)
            }
            placeholder="Enter the exact message you want to sign"
            maxLength={4096}
            disabled={isBusy}
          />

          <div className="textarea-footer">
            <span>
              Review the exact message in your wallet or on your
              Ledger.
            </span>

            <span>{message.length} / 4096</span>
          </div>

          <button
            className="primary-button full-width"
            type="button"
            onClick={signMessage}
            disabled={
              isBusy ||
              !message.trim().length ||
              (!usingAppKit && !usingLedger)
            }
          >
            {busyAction === "sign-message"
              ? "Waiting for approval..."
              : usingAppKit
                ? "Sign message with wallet"
                : usingLedger
                  ? "Sign message with Ledger"
                  : "Connect a wallet first"}
          </button>

          <div className="warning-box">
            Never approve an unknown message. A signature
            proves control of the Ethereum account and can be
            used for authentication.
          </div>

          <div className="results signature-results">
            <div
              className={`verification-result ${
                signatureValid === true
                  ? "verification-valid"
                  : signatureValid === false
                    ? "verification-invalid"
                    : ""
              }`}
            >
              <span>Verification status</span>

              <strong>
                {signatureValid === true
                  ? "VALID ✓"
                  : signatureValid === false
                    ? "INVALID ✕"
                    : "Not verified"}
              </strong>

              {signatureValid === true && (
                <p>
                  The recovered address matches the signing
                  Ethereum address.
                </p>
              )}

              {signatureValid === false && (
                <p>
                  The recovered address does not match the
                  signing Ethereum address.
                </p>
              )}
            </div>

            <OutputField
              label={
                walletConnected
                  ? "Wallet used"
                  : "Derivation path used"
              }
              value={signedDerivationPath}
            />

            <OutputField
              label="Original message"
              value={originalSignedMessage}
              mono={false}
              large
            />

            <OutputField
              label="Timestamp added"
              value={
                exactSignedMessage
                  ? signedTimestamp
                    ? "YES"
                    : "NO"
                  : ""
              }
              mono={false}
            />

            {signedTimestamp && (
              <OutputField
                label="UTC timestamp"
                value={signedTimestamp}
              />
            )}

            <OutputField
              label="Exact message signed"
              value={exactSignedMessage}
              mono={false}
              large
            />

            <OutputField
              label="Signing Ethereum address"
              value={signingAddress}
            />

            <OutputField
              label="Recovered Ethereum address"
              value={recoveredAddress}
            />

            <OutputField
              label="Complete signature"
              value={signature}
            />

            <div className="signature-parts">
              <OutputField
                label="r"
                value={signatureR}
              />

              <OutputField
                label="s"
                value={signatureS}
              />

              <OutputField
                label="v"
                value={signatureV}
              />
            </div>
          </div>
        </article>
      </section>

      <section className="device-instructions">
        <div>
          <h3>Wallet selection</h3>

          <p>
            When a wallet is connected through Reown AppKit, the account and signing buttons use that wallet. Ledger remains available separately through desktop WebHID.
          </p>
        </div>

        <button
          type="button"
          className="text-button"
          onClick={clearResults}
          disabled={isBusy}
        >
          Clear results
        </button>
      </section>
    </main>
  );
}

export default App;