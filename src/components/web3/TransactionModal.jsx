"use client";

import React, { useEffect, useState } from "react";
import { confetti } from "@/lib/confetti";
import { CheckCircle2, XCircle, ExternalLink, Copy, Check, Wallet } from "lucide-react";
import { useWeb3 } from "@/context/Web3Context";
import { EXPLORER } from "@/lib/network";
import { Spinner } from "@/components/ui/primitives";

const STAGES = [
  { key: "preparing", label: "Prepare" },
  { key: "waiting_wallet", label: "Sign" },
  { key: "submitted", label: "Broadcast" },
  { key: "confirmed", label: "Confirmed" },
];

const COPY = {
  preparing: "Getting everything ready…",
  waiting_wallet: "Check MetaMask and confirm the request.",
  submitted: "Sent to the network. Waiting for a block — usually 10–20 seconds.",
  confirmed: "Done. The contract state is updated.",
};

export function TransactionModal() {
  const { txState, resetTxState } = useWeb3();
  const [copied, setCopied] = useState(false);

  // Celebrate every confirmed transaction
  useEffect(() => {
    if (txState.status === "confirmed") confetti();
  }, [txState.status]);

  if (txState.status === "idle") return null;

  const idx = STAGES.findIndex((s) => s.key === txState.status);
  const failed = txState.status === "failed";
  const done = txState.status === "confirmed";
  const closable = failed || done;

  const copy = () => {
    navigator.clipboard.writeText(txState.txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={closable ? resetTxState : undefined}
    >
      <div className="card w-full max-w-md p-6 sm:p-7 space-y-6 animate-fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-4">
          <div
            className={`w-11 h-11 shrink-0 rounded-2xl grid place-items-center ${
              failed ? "bg-bad/10 text-bad" : done ? "bg-ok/10 text-ok" : "bg-lime/10 text-lime"
            }`}
          >
            {failed ? (
              <XCircle className="w-5 h-5" />
            ) : done ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : txState.status === "waiting_wallet" ? (
              <Wallet className="w-5 h-5" />
            ) : (
              <Spinner className="w-5 h-5" />
            )}
          </div>
          <div className="space-y-1 min-w-0">
            <h3 className="text-lg font-semibold text-fg leading-snug">{txState.title || "Transaction"}</h3>
            {!failed && <p className="text-sm text-dim">{COPY[txState.status]}</p>}
          </div>
        </div>

        {failed ? (
          <div className="well p-3.5 text-sm text-fg/90 leading-relaxed break-words max-h-32 overflow-y-auto">
            {txState.error || "The transaction was rejected or reverted."}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {STAGES.map((s, i) => (
              <div key={s.key} className="space-y-2">
                <div
                  className={`h-1 rounded-full transition-colors ${
                    i < idx || done ? "bg-ok" : i === idx ? "bg-lime animate-pulse" : "bg-raised"
                  }`}
                />
                <span className={`block text-[11px] ${i <= idx ? "text-fg" : "text-faint"}`}>{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {txState.txHash && (
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-line text-xs">
            <span className="flex items-center gap-2 min-w-0">
              <span className="text-faint">Tx</span>
              <span className="num text-fg truncate">
                {txState.txHash.slice(0, 10)}…{txState.txHash.slice(-8)}
              </span>
              <button onClick={copy} className="text-faint hover:text-fg" aria-label="Copy hash">
                {copied ? <Check className="w-3.5 h-3.5 text-ok" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </span>
            {EXPLORER && (
              <a
                href={`${EXPLORER}/tx/${txState.txHash}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-lime hover:underline shrink-0"
              >
                Etherscan <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}

        {closable && (
          <button onClick={resetTxState} className={`${done ? "btn-primary" : "btn-secondary"} w-full`}>
            {done ? "Done" : "Close"}
          </button>
        )}
      </div>
    </div>
  );
}
