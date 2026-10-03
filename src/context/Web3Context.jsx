"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/context/ToastContext";
import { formatEther } from "@/lib/formatters";
import { RPC_URL } from "@/lib/network";
import { signInWithWallet } from "@/lib/api";
import { isMobileDevice } from "@/lib/web3Mobile";
import { getEthereumProvider } from "@/lib/metamaskSdk";

// Talks to the injected wallet directly (EIP-1193) with MetaMask SDK fallback for mobile browsers.

const Web3Context = createContext(null);

const SEPOLIA_CHAIN_ID = 11155111;
const HARDHAT_CHAIN_ID = 31337;

const eth = () => (typeof window !== "undefined" ? window.ethereum : undefined);

export function Web3Provider({ children }) {
  const router = useRouter();
  const toast = useToast();
  const [account, setAccount] = useState(null);
  const [chainId, setChainId] = useState(null);
  const [balance, setBalance] = useState("0");
  const [isConnecting, setIsConnecting] = useState(false);
  const [hasMetaMask, setHasMetaMask] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [authenticatedUser, setAuthenticatedUser] = useState(null);
  const accountRef = useRef(null);

  const [txState, setTxState] = useState({
    status: "idle", // idle, preparing, waiting_wallet, submitted, confirmed, failed
    txHash: null,
    title: "",
    error: null,
  });

  const updateAccountAndBalance = useCallback(async (selectedAccount) => {
    let provider = eth();
    if (!provider) provider = await getEthereumProvider();
    if (!selectedAccount || !provider) return;
    try {
      const [cid, wei] = await Promise.all([
        provider.request({ method: "eth_chainId" }),
        provider.request({ method: "eth_getBalance", params: [selectedAccount, "latest"] }),
      ]);
      setChainId(parseInt(cid, 16));
      setBalance(formatEther(BigInt(wei)));
    } catch (err) {
      console.error("Failed to fetch balance:", err);
    }
  }, []);

  const applyAccount = useCallback(
    (acc) => {
      const next = acc ? acc.toLowerCase() : null;
      accountRef.current = next;
      setAccount(next);
      if (next) updateAccountAndBalance(next);
      else {
        setBalance("0");
        setAuthenticatedUser(null);
      }
    },
    [updateAccountAndBalance]
  );

  const switchToSepolia = useCallback(async (explicitProvider) => {
    let provider = explicitProvider || eth();
    if (!provider) provider = await getEthereumProvider();
    if (!provider) return;
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0xaa36a7" }] });
    } catch (switchError) {
      if (switchError.code === 4902) {
        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0xaa36a7",
                chainName: "Sepolia Testnet",
                nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: [RPC_URL],
                blockExplorerUrls: ["https://sepolia.etherscan.io"],
              },
            ],
          });
        } catch (addError) {
          console.error("Failed to add Sepolia network:", addError);
        }
      } else if (switchError.code !== 4001) {
        console.error("Failed to switch to Sepolia:", switchError);
      }
    }
  }, []);

  const connectWallet = useCallback(async () => {
    setIsConnecting(true);
    try {
      let provider = eth();
      if (!provider) {
        provider = await getEthereumProvider();
      }

      if (!provider) {
        setIsWalletModalOpen(true);
        return null;
      }

      const accs = await provider.request({ method: "eth_requestAccounts" });
      if (accs?.length) {
        const addr = accs[0].toLowerCase();
        applyAccount(addr);
        setIsWalletModalOpen(false);

        // Ensure chain is Sepolia
        try {
          const cidHex = await provider.request({ method: "eth_chainId" });
          const cid = parseInt(cidHex, 16);
          if (cid !== SEPOLIA_CHAIN_ID && cid !== HARDHAT_CHAIN_ID) {
            await switchToSepolia(provider);
          }
        } catch {}

        return addr;
      }
    } catch (err) {
      if (err?.code === -32002) {
        toast.info("Check MetaMask", "A connection request is already open — check MetaMask to finish it.");
      } else if (err?.code === 4001 || err?.message?.toLowerCase().includes("user rejected")) {
        // User rejected connection
      } else {
        console.error("Wallet connection error:", err);
        setIsWalletModalOpen(true);
      }
    } finally {
      setIsConnecting(false);
    }
    return null;
  }, [applyAccount, toast, switchToSepolia]);

  // Restore an already-authorized account and subscribe to wallet events
  useEffect(() => {
    setIsMobile(isMobileDevice());

    let unsub = null;

    async function init() {
      let provider = eth();
      if (!provider && typeof window !== "undefined") {
        provider = await getEthereumProvider();
      }
      setHasMetaMask(Boolean(provider));

      // Handle auto-connect if redirected via deep-link ?connect=true
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        if (params.get("connect") === "true") {
          params.delete("connect");
          const nextQuery = params.toString() ? `?${params.toString()}` : "";
          window.history.replaceState({}, "", window.location.pathname + nextQuery + window.location.hash);
          if (provider) {
            connectWallet();
          }
        }
      }

      if (!provider) return;

      provider
        .request({ method: "eth_accounts" })
        .then((accs) => accs?.length && applyAccount(accs[0]))
        .catch(() => {});

      const onAccounts = (accs) => applyAccount(accs?.[0] || null);
      const onChain = (hex) => {
        setChainId(parseInt(hex, 16));
        if (accountRef.current) updateAccountAndBalance(accountRef.current);
      };
      const onVisible = () => {
        if (document.visibilityState === "visible" && accountRef.current) updateAccountAndBalance(accountRef.current);
      };

      provider.on?.("accountsChanged", onAccounts);
      provider.on?.("chainChanged", onChain);
      document.addEventListener("visibilitychange", onVisible);

      unsub = () => {
        provider.removeListener?.("accountsChanged", onAccounts);
        provider.removeListener?.("chainChanged", onChain);
        document.removeEventListener("visibilitychange", onVisible);
      };
    }

    init();

    return () => {
      if (unsub) unsub();
    };
  }, [applyAccount, updateAccountAndBalance, connectWallet]);

  const openWalletModal = () => setIsWalletModalOpen(true);
  const closeWalletModal = () => setIsWalletModalOpen(false);

  const disconnectWallet = () => {
    applyAccount(null);
    fetch("/api/auth/session", { method: "DELETE" }).catch(() => {});
  };

  /** Starts a server-side wallet session (one free signature). */
  const authenticateWithWallet = async () => {
    if (!account) return null;
    try {
      const session = await signInWithWallet(account);
      setAuthenticatedUser(session);
      return session;
    } catch (err) {
      toast.error("Wallet sign-in failed", err.message);
      return null;
    }
  };

  const resetTxState = () => setTxState({ status: "idle", txHash: null, title: "", error: null });

  const isSepolia = chainId === SEPOLIA_CHAIN_ID;
  const isSupportedChain = chainId === SEPOLIA_CHAIN_ID || chainId === HARDHAT_CHAIN_ID;

  return (
    <Web3Context.Provider
      value={{
        account,
        chainId,
        balance,
        hasMetaMask,
        isMobile,
        isWalletModalOpen,
        openWalletModal,
        closeWalletModal,
        isConnecting,
        isSepolia,
        isSupportedChain,
        authenticatedUser,
        txState,
        setTxState,
        resetTxState,
        connectWallet,
        disconnectWallet,
        switchToSepolia,
        authenticateWithWallet,
        updateAccountAndBalance,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
}

export function useWeb3() {
  const context = useContext(Web3Context);
  if (!context) throw new Error("useWeb3 must be used within a Web3Provider");
  return context;
}
