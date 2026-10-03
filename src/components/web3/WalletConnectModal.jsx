"use client";

import React, { useState, useEffect } from "react";
import { useWeb3 } from "@/context/Web3Context";
import { getMetaMaskDeepLink, getStoreLink } from "@/lib/web3Mobile";
import {
  X,
  Smartphone,
  Laptop,
  ExternalLink,
  Download,
  Copy,
  Check,
  Compass,
  ArrowRight,
  Shield,
  Sparkles,
} from "lucide-react";

export function WalletConnectModal() {
  const { isWalletModalOpen, closeWalletModal, isMobile, connectWallet, isConnecting } = useWeb3();
  const [activeTab, setActiveTab] = useState("mobile");
  const [copied, setCopied] = useState(false);
  const [deepLink, setDeepLink] = useState("");
  const [storeLink, setStoreLink] = useState("");
  const [currentUrl, setCurrentUrl] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setActiveTab(isMobile ? "mobile" : "desktop");
      setDeepLink(getMetaMaskDeepLink(window.location.href, true));
      setStoreLink(getStoreLink());
      setCurrentUrl(window.location.href);
    }
  }, [isMobile, isWalletModalOpen]);

  // Handle escape key
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && isWalletModalOpen) closeWalletModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isWalletModalOpen, closeWalletModal]);

  if (!isWalletModalOpen) return null;

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(currentUrl || window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/75 backdrop-blur-md animate-fade-in"
      onClick={closeWalletModal}
    >
      <div
        className="card w-full max-w-lg p-6 sm:p-7 space-y-6 animate-fade-up border-line-strong bg-panel/95 shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top glow accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r from-transparent via-lime to-transparent" />

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#F6851B]/15 border border-[#F6851B]/30 grid place-items-center text-[#F6851B] shrink-0 shadow-sm">
              <MetaMaskFoxIcon className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-fg flex items-center gap-2">
                Connect MetaMask
              </h2>
              <p className="text-xs sm:text-sm text-dim mt-0.5">
                {activeTab === "mobile"
                  ? "Connect easily using the MetaMask Mobile app"
                  : "Install the MetaMask browser extension"}
              </p>
            </div>
          </div>
          <button
            onClick={closeWalletModal}
            className="w-9 h-9 rounded-full grid place-items-center text-dim hover:text-fg hover:bg-raised transition"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher: Mobile vs Desktop */}
        <div className="flex p-1 rounded-xl bg-raised border border-line text-xs font-medium">
          <button
            onClick={() => setActiveTab("mobile")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition ${
              activeTab === "mobile"
                ? "bg-panel text-fg shadow-sm font-semibold"
                : "text-dim hover:text-fg"
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            Phone / Mobile
          </button>
          <button
            onClick={() => setActiveTab("desktop")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg transition ${
              activeTab === "desktop"
                ? "bg-panel text-fg shadow-sm font-semibold"
                : "text-dim hover:text-fg"
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            Computer / Desktop
          </button>
        </div>

        {/* Mobile View */}
        {activeTab === "mobile" ? (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-raised/70 border border-line text-xs space-y-1.5">
              <div className="flex items-center gap-2 text-fg font-semibold">
                <span className="w-2 h-2 rounded-full bg-lime animate-pulse" />
                Connecting on Mobile
              </div>
              <p className="text-dim leading-relaxed">
                Connect directly with the <strong>MetaMask app</strong> on your device, or open CommitX inside MetaMask&apos;s Web3 browser.
              </p>
            </div>

            {/* Main Action 1: Connect via MetaMask Mobile SDK */}
            <div className="space-y-2">
              <button
                onClick={() => connectWallet()}
                disabled={isConnecting}
                className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 text-base font-semibold shadow-glow"
              >
                <MetaMaskFoxIcon className="w-5 h-5" />
                <span>{isConnecting ? "Connecting..." : "Connect MetaMask App"}</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
              <p className="text-[11px] text-faint text-center">
                Prompts MetaMask to approve and link your wallet seamlessly.
              </p>
            </div>

            {/* Main Action 2: Open in MetaMask Web3 Browser */}
            <div className="space-y-2 pt-1">
              <a
                href={deepLink}
                className="btn-secondary w-full py-3 flex items-center justify-center gap-2 text-xs font-semibold"
              >
                <Compass className="w-4 h-4 text-lime" />
                <span>Open in MetaMask In-App Browser</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>
              <p className="text-[10px] text-faint text-center">
                Directly opens this challenge page inside MetaMask&apos;s Web3 browser.
              </p>
            </div>

            <div className="relative py-1 flex items-center justify-center">
              <span className="w-full border-t border-line absolute" />
              <span className="relative px-3 bg-panel text-[11px] text-faint uppercase tracking-wider font-mono">
                or
              </span>
            </div>

            {/* Install MetaMask or Copy URL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <a
                href={storeLink}
                target="_blank"
                rel="noreferrer"
                className="btn-secondary py-2.5 px-3 flex items-center justify-center gap-2 text-xs"
              >
                <Download className="w-4 h-4 text-lime" />
                <span>Download MetaMask App</span>
                <ExternalLink className="w-3 h-3 text-faint" />
              </a>

              <button
                onClick={handleCopy}
                className="btn-secondary py-2.5 px-3 flex items-center justify-center gap-2 text-xs"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-ok" />
                    <span className="text-ok font-medium">Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy Page Link</span>
                  </>
                )}
              </button>
            </div>

            {/* Step-by-step guidance */}
            <div className="pt-2 border-t border-line/60">
              <p className="text-xs font-medium text-dim mb-2 flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-lime" />
                How the mobile connection works:
              </p>
              <ol className="space-y-2 text-xs text-dim">
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-raised text-fg font-mono text-[11px] grid place-items-center shrink-0 border border-line">
                    1
                  </span>
                  <span>
                    Install the free <strong>MetaMask app</strong> from the App Store or Google Play.
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-raised text-fg font-mono text-[11px] grid place-items-center shrink-0 border border-line">
                    2
                  </span>
                  <span>
                    Tap <strong>Open in MetaMask App</strong> above (or paste the copied link into MetaMask&apos;s in-app browser).
                  </span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-raised text-fg font-mono text-[11px] grid place-items-center shrink-0 border border-line">
                    3
                  </span>
                  <span>
                    Approve the connection prompt inside MetaMask and start staking!
                  </span>
                </li>
              </ol>
            </div>
          </div>
        ) : (
          /* Desktop View */
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-raised/70 border border-line text-xs space-y-2">
              <p className="text-fg font-semibold flex items-center gap-2">
                <Laptop className="w-4 h-4 text-lime" />
                MetaMask Extension required
              </p>
              <p className="text-dim leading-relaxed">
                CommitX connects to Ethereum via the official MetaMask extension. Install it once to create, join, and verify challenges safely.
              </p>
            </div>

            <a
              href="https://metamask.io/download/"
              target="_blank"
              rel="noreferrer"
              className="btn-primary w-full py-3.5 flex items-center justify-center gap-2 font-semibold shadow-glow"
            >
              <Download className="w-4 h-4" />
              <span>Install MetaMask for Desktop</span>
              <ExternalLink className="w-4 h-4 ml-1 opacity-70" />
            </a>

            <div className="well p-3.5 space-y-2 text-xs">
              <p className="font-medium text-fg">Supported Browsers:</p>
              <div className="flex flex-wrap gap-2 text-[11px]">
                {["Google Chrome", "Brave Browser", "Mozilla Firefox", "Microsoft Edge", "Opera"].map((b) => (
                  <span key={b} className="chip bg-panel border-line text-dim">
                    {b}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-faint pt-1">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-lime" />
                100% Non-custodial & secure
              </span>
              <button
                onClick={() => setActiveTab("mobile")}
                className="text-lime hover:underline"
              >
                Using a phone? View mobile steps →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetaMaskFoxIcon({ className = "w-5 h-5" }) {
  return (
    <svg className={className} viewBox="0 0 256 256" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M239.5 128.5L208.5 73.5L145 25.5L128 39.5L146.5 78.5L96.5 72.5L78 40.5L62.5 56L16.5 128.5L62.5 160.5L78 144.5L108 174.5L148 174.5L178 144.5L193.5 160.5L239.5 128.5Z"
        fill="#E2761B"
        stroke="#E2761B"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 128.5L78 144.5L62.5 160.5L16.5 128.5Z"
        fill="#E4761B"
      />
      <path
        d="M239.5 128.5L193.5 160.5L178 144.5L239.5 128.5Z"
        fill="#E4761B"
      />
      <path
        d="M62.5 160.5L84.5 204.5L128 230.5L171.5 204.5L193.5 160.5L178 144.5L148 174.5L108 174.5L78 144.5L62.5 160.5Z"
        fill="#D7C1B3"
      />
      <path
        d="M108 174.5L84.5 204.5L128 230.5L171.5 204.5L148 174.5H108Z"
        fill="#233447"
      />
    </svg>
  );
}
