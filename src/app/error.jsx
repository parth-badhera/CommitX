"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="shell py-24">
      <div className="card max-w-lg mx-auto p-8 text-center space-y-5 animate-fade-up">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-warn/10 text-warn grid place-items-center">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-fg">Something went wrong</h1>
          <p className="text-sm text-dim">
            This page hit an unexpected error. Your funds are safe — they live in the smart contract, not on this page.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <button onClick={reset} className="btn-primary">
            <RotateCcw className="w-4 h-4" /> Try again
          </button>
          <Link href="/" className="btn-secondary">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
