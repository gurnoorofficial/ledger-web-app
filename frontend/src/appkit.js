import { createAppKit } from "@reown/appkit/react";
import { EthersAdapter } from "@reown/appkit-adapter-ethers";
import { mainnet } from "@reown/appkit/networks";

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID;

if (!projectId) {
  throw new Error(
    "VITE_REOWN_PROJECT_ID is missing from the .env file."
  );
}

const metadata = {
  name: "Ethereum Wallet Toolkit",
  description:
    "Connect an Ethereum wallet and sign personal messages.",
  url: window.location.origin,
  icons: [`${window.location.origin}/favicon.ico`],
};

createAppKit({
  adapters: [new EthersAdapter()],
  networks: [mainnet],
  projectId,
  metadata,
  features: {
    analytics: false,
  },
});