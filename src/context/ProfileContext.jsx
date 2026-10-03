"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useWeb3 } from "@/context/Web3Context";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import { defaultName } from "@/lib/identity";

export const ACCENTS = [
  { id: "lime", label: "Lime", rgb: "215 255 62" },
  { id: "sky", label: "Sky", rgb: "125 211 252" },
  { id: "mint", label: "Mint", rgb: "110 231 183" },
  { id: "lavender", label: "Lavender", rgb: "196 181 253" },
  { id: "pink", label: "Pink", rgb: "249 168 212" },
  { id: "peach", label: "Peach", rgb: "253 186 116" },
];

const ProfileContext = createContext(null);

/** Your display name, avatar and accent colour — available everywhere. */
export function ProfileProvider({ children }) {
  const { account } = useWeb3();
  const { user } = useAuth();
  const wallet = (account || user?.walletAddress || "").toLowerCase() || null;

  const [profile, setProfile] = useState(null);
  const [reputation, setReputation] = useState(null);
  const [accent, setAccentState] = useState("lime");

  useEffect(() => {
    try {
      setAccentState(localStorage.getItem("cx_accent") || "lime");
    } catch {}
  }, []);

  const setAccent = useCallback((id) => {
    setAccentState(id);
    document.documentElement.dataset.accent = id;
    try {
      localStorage.setItem("cx_accent", id);
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!wallet) {
      setReputation(null);
      setProfile(user ? { wallet: null, name: user.name || "You", avatar: user.avatar, hasCustomName: true } : null);
      return;
    }
    // Instant placeholder, then the saved profile
    setProfile((p) => (p?.wallet === wallet ? p : { wallet, name: defaultName(wallet), avatar: null, hasCustomName: false }));
    fetch(`/api/profile?wallet=${wallet}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => !cancelled && d.profile && setProfile(d.profile))
      .catch(() => {});
    fetch(`/api/reputation?wallets=${wallet}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => !cancelled && setReputation(d.reputations?.[wallet] || null))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [wallet, user]);

  /** Saves name and/or avatar. Asks for a free wallet signature the first time. */
  const updateProfile = useCallback(
    async (changes) => {
      if (!wallet) throw new Error("Connect your wallet to personalise your profile.");
      const { profile: saved } = await apiFetch("/api/profile", {
        method: "POST",
        wallet,
        json: { walletAddress: wallet, ...changes },
      });
      setProfile(saved);
      return saved;
    },
    [wallet]
  );

  return (
    <ProfileContext.Provider value={{ profile, wallet, reputation, updateProfile, accent, setAccent }}>{children}</ProfileContext.Provider>
  );
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within a ProfileProvider");
  return ctx;
}
