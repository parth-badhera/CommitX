"use client";

/**
 * MetaMask SDK Manager for CommitX
 * Handles seamless wallet connections across:
 * 1. Desktop browsers with MetaMask extension
 * 2. Mobile browsers (Chrome / Safari) connecting to MetaMask mobile app
 * 3. In-app MetaMask Web3 browser
 * 4. Desktop browsers without extension (QR modal)
 */

let sdkInstance = null;

export async function getMetaMaskSDK() {
  if (typeof window === "undefined") return null;

  if (!sdkInstance) {
    try {
      const { MetaMaskSDK } = await import("@metamask/sdk");
      const origin =
        typeof window !== "undefined" && window.location.origin
          ? window.location.origin
          : "https://commit-x.vercel.app";

      sdkInstance = new MetaMaskSDK({
        dappMetadata: {
          name: "CommitX",
          url: origin,
          iconUrl: `${origin}/icon.svg`,
        },
        checkInstallationImmediately: false,
        preferDesktop: false,
        useDeeplink: true,
        logging: {
          developerMode: process.env.NODE_ENV !== "production",
        },
      });

      await sdkInstance.init();
    } catch (err) {
      console.warn("Failed to initialize MetaMask SDK:", err);
      return null;
    }
  }

  return sdkInstance;
}

/**
 * Returns an active EIP-1193 provider.
 * Falls back to MetaMask SDK if window.ethereum is not injected by an extension.
 */
export async function getEthereumProvider() {
  if (typeof window === "undefined") return null;

  // 1. Native extension or in-app browser injection
  if (window.ethereum) {
    return window.ethereum;
  }

  // 2. MetaMask SDK bridge for mobile Chrome/Safari and non-extension browsers
  try {
    const sdk = await getMetaMaskSDK();
    if (sdk) {
      const sdkProvider = sdk.getProvider();
      if (sdkProvider) {
        if (!window.ethereum) {
          window.ethereum = sdkProvider;
        }
        return sdkProvider;
      }
    }
  } catch (err) {
    console.error("Error retrieving MetaMask SDK provider:", err);
  }

  return window.ethereum || null;
}
