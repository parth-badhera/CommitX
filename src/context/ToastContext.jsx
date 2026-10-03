"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

const STYLES = {
  success: { icon: CheckCircle2, tone: "text-ok" },
  error: { icon: AlertCircle, tone: "text-bad" },
  info: { icon: Info, tone: "text-violet" },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (type, title, body) => {
      const id = ++idRef.current;
      setToasts((t) => [...t.slice(-3), { id, type, title, body }]);
      setTimeout(() => dismiss(id), type === "error" ? 7000 : 4000);
    },
    [dismiss]
  );

  const stable = useMemo(
    () => ({
      success: (title, body) => push("success", title, body),
      error: (title, body) => push("error", title, body),
      info: (title, body) => push("info", title, body),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={stable}>
      {children}
      <div
        aria-live="polite"
        className="fixed z-[70] bottom-4 right-4 left-4 sm:left-auto sm:w-96 flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => {
          const { icon: Icon, tone } = STYLES[t.type];
          return (
            <div key={t.id} className="card pointer-events-auto p-4 flex items-start gap-3 animate-slide-in bg-panel">
              <Icon className={`w-5 h-5 shrink-0 mt-px ${tone}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-fg">{t.title}</p>
                {t.body && <p className="text-sm text-dim mt-0.5 break-words">{t.body}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="text-faint hover:text-fg" aria-label="Dismiss">
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
