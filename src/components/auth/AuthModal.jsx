"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useWeb3 } from "@/context/Web3Context";
import { shortenAddress } from "@/lib/formatters";
import { X, Check, Wallet, AlertCircle, Sparkles, Smartphone } from "lucide-react";
import { Spinner } from "@/components/ui/primitives";
import { personalSign } from "@/lib/api";

export function AuthModal() {
  const { user, isAuthModalOpen, closeAuthModal, signInWithGoogle, signInWithDemo, linkWallet, setAuthStep } =
    useAuth();
  const { account, balance, connectWallet, hasMetaMask, isMobile, openWalletModal } = useWeb3();
  const [busy, setBusy] = useState(null); // "google" | "demo" | "wallet"
  const [error, setError] = useState(null);

  if (!isAuthModalOpen) return null;

  const step1Done = Boolean(user);
  const step2Done = Boolean(user?.walletAddress);

  const handleGoogle = async () => {
    setError(null);
    setBusy("google");
    try {
      await signInWithGoogle(); // redirects
    } catch {
      setError("Google sign-in couldn't start. You can use the demo account instead.");
      setBusy(null);
    }
  };

  const handleDemo = async () => {
    setError(null);
    setBusy("demo");
    try {
      await signInWithDemo("alex.rivera@gmail.com", "Alex Rivera");
      setAuthStep(2);
    } catch (err) {
      setError(err.message || "Demo sign-in failed.");
    } finally {
      setBusy(null);
    }
  };

  const handleLink = async () => {
    setError(null);
    if (!hasMetaMask) {
      openWalletModal();
      return;
    }
    setBusy("wallet");
    try {
      const wallet = account || (await connectWallet());
      if (!wallet) return;
      await linkWallet(wallet, (message) => personalSign(message, wallet));
      setTimeout(closeAuthModal, 900);
    } catch (err) {
      setError(err.message || "Couldn't link your wallet.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={closeAuthModal}>
      <div className="card w-full max-w-md p-6 sm:p-7 space-y-6 animate-fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-fg">Get started</h2>
            <p className="text-sm text-dim mt-1">Two quick steps: your identity, then your wallet.</p>
          </div>
          <button onClick={closeAuthModal} className="w-9 h-9 rounded-full grid place-items-center text-dim hover:text-fg hover:bg-raised" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <ol className="grid grid-cols-2 gap-2">
          <StepPill n={1} label="Account" sub={step1Done ? user.email : "Google sign-in"} done={step1Done} current={!step1Done} />
          <StepPill
            n={2}
            label="Wallet"
            sub={step2Done ? shortenAddress(user.walletAddress) : "MetaMask"}
            done={step2Done}
            current={step1Done && !step2Done}
          />
        </ol>

        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-bad/10 border border-bad/25 text-sm text-bad">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!step1Done ? (
          <div className="space-y-3">
            <button onClick={handleGoogle} disabled={!!busy} className="btn w-full bg-fg text-ink hover:bg-white">
              {busy === "google" ? <Spinner /> : <GoogleIcon />}
              Continue with Google
            </button>
            <div className="flex items-center gap-3 text-[11px] text-faint">
              <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
            </div>
            <button onClick={handleDemo} disabled={!!busy} className="btn-secondary w-full">
              {busy === "demo" ? <Spinner /> : <Sparkles className="w-4 h-4 text-lime" />}
              Use a demo account
            </button>
          </div>
        ) : step2Done ? (
          <div className="text-center space-y-4 py-2">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-ok/10 text-ok grid place-items-center">
              <Check className="w-6 h-6" />
            </div>
            <div>
              <p className="text-base font-semibold text-fg">You're all set</p>
              <p className="num text-xs text-dim mt-1 break-all">{user.walletAddress}</p>
            </div>
            <button onClick={closeAuthModal} className="btn-primary w-full">
              Start exploring
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="well p-4 flex items-center gap-3">
              {user.avatar ? (
                <img src={user.avatar} alt="" className="w-9 h-9 rounded-full object-cover" />
              ) : (
                <span className="w-9 h-9 rounded-full bg-panel" />
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-fg truncate">{user.name}</p>
                <p className="text-xs text-dim truncate">{user.email}</p>
              </div>
            </div>
            {account && (
              <div className="flex items-center justify-between text-xs px-1">
                <span className="text-dim">
                  Detected <span className="num text-fg">{shortenAddress(account)}</span>
                </span>
                <span className="num text-lime">{parseFloat(balance || "0").toFixed(3)} ETH</span>
              </div>
            )}
            {!hasMetaMask && isMobile ? (
              <div className="p-3.5 rounded-xl bg-lime/10 border border-lime/25 space-y-2.5 text-xs">
                <div className="flex items-center gap-2 font-semibold text-fg">
                  <Smartphone className="w-4 h-4 text-lime" />
                  MetaMask Mobile Required
                </div>
                <p className="text-dim leading-relaxed">
                  Mobile browsers don&apos;t support wallet extensions. Open CommitX inside the MetaMask Mobile app to link your wallet.
                </p>
                <button
                  type="button"
                  onClick={() => openWalletModal()}
                  className="btn-primary btn-sm w-full py-2.5"
                >
                  Connect with MetaMask Mobile
                </button>
              </div>
            ) : (
              <button onClick={handleLink} disabled={!!busy} className="btn-primary w-full">
                {busy === "wallet" ? <Spinner /> : <Wallet className="w-4 h-4" />}
                {account ? "Sign to link MetaMask" : "Connect & link MetaMask"}
              </button>
            )}
            <p className="text-xs text-faint text-center">
              You&apos;ll sign a message to prove you own the wallet. No gas, no transaction.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StepPill({ n, label, sub, done, current }) {
  return (
    <li
      className={`p-3 rounded-xl border flex items-center gap-3 ${
        done ? "border-ok/25 bg-ok/5" : current ? "border-lime/40 bg-lime/5" : "border-line bg-raised/50"
      }`}
    >
      <span
        className={`w-7 h-7 shrink-0 rounded-lg grid place-items-center text-xs font-bold ${
          done ? "bg-ok text-ink" : current ? "bg-lime text-ink" : "bg-raised text-faint"
        }`}
      >
        {done ? <Check className="w-4 h-4" /> : n}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-fg">{label}</span>
        <span className="block text-[11px] text-dim truncate">{sub}</span>
      </span>
    </li>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
      <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.97 0 12s.45 3.84 1.25 5.42l4.03-3.15z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
    </svg>
  );
}
