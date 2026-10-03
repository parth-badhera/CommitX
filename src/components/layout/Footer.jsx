"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ExternalLink, Copy, Check } from "lucide-react";
import { Logo } from "@/components/layout/Navbar";
import { CONTRACT_ADDRESS, EXPLORER } from "@/lib/network";
import { shortenAddress } from "@/lib/formatters";

export function Footer() {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(CONTRACT_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <footer className="mt-32 border-t border-line">
      <div className="shell py-12 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4 max-w-sm">
          <Logo />
          <p className="text-sm text-dim leading-relaxed">
            Stake ETH on your goals. Prove progress, get verified by your cohort, and pull your payout
            straight from the contract.
          </p>
          <p className="text-xs text-faint">
            Runs on Ethereum Sepolia. Testnet ETH only, with no real-world value.
          </p>
          <a href="/commitx-manual.pdf" download="CommitX-Beginner-Manual.pdf" className="btn-secondary btn-sm">
            Download the beginner manual (PDF)
          </a>
        </div>

        <div className="space-y-3">
          <p className="eyebrow">Product</p>
          <ul className="space-y-2 text-sm">
            {[
              ["Explore", "/explore"],
              ["Create a challenge", "/create"],
              ["Dashboard", "/dashboard"],
              ["Verify proofs", "/verify"],
              ["Beginner's guide", "/learn"],
            ].map(([label, href]) => (
              <li key={href}>
                <Link href={href} className="text-dim hover:text-fg transition">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <p className="eyebrow">Contract</p>
          <div className="flex items-center gap-2 text-sm">
            <span className="num text-fg">{shortenAddress(CONTRACT_ADDRESS)}</span>
            <button onClick={copy} className="text-faint hover:text-fg transition" aria-label="Copy address">
              {copied ? <Check className="w-3.5 h-3.5 text-ok" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          {EXPLORER && (
            <a
              href={`${EXPLORER}/address/${CONTRACT_ADDRESS}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-dim hover:text-fg transition"
            >
              Etherscan <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <div>
            <Link href="/protocol" className="text-sm text-dim hover:text-fg transition">
              Protocol stats
            </Link>
          </div>
        </div>
      </div>
      <div className="border-t border-line">
        <div className="shell py-5 flex flex-col sm:flex-row justify-between gap-2 text-xs text-faint">
          <span>© {new Date().getFullYear()} CommitX</span>
          <span className="num">EIP-712 attested settlement · pull-based withdrawals</span>
        </div>
      </div>
    </footer>
  );
}
