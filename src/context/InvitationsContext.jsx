"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useWeb3 } from "@/context/Web3Context";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";

const InvitationsContext = createContext({
  invitations: [],
  pendingCount: 0,
  loading: false,
  isModalOpen: false,
  setIsModalOpen: () => {},
  refreshInvitations: () => {},
  declineInvitation: async () => {},
});

export function InvitationsProvider({ children }) {
  const { account } = useWeb3();
  const { user } = useAuth();
  const [invitations, setInvitations] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const activeWallet = user?.walletAddress || account;

  const fetchInvitations = useCallback(async () => {
    if (!activeWallet) {
      setInvitations([]);
      setPendingCount(0);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(
        `/api/invitations?walletAddress=${encodeURIComponent(activeWallet)}`
      );
      const data = await res.json();
      if (data.invitations) {
        setInvitations(data.invitations);
        setPendingCount(data.pendingCount || 0);
      }
    } catch (err) {
      console.error("Error fetching invitations:", err);
    } finally {
      setLoading(false);
    }
  }, [activeWallet]);

  useEffect(() => {
    fetchInvitations();
    // Poll every 25 seconds for new incoming invites
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") fetchInvitations();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchInvitations]);

  const declineInvitation = async (inviteId) => {
    if (!activeWallet) return;
    try {
      await apiFetch(`/api/invitations/${inviteId}/decline`, {
        method: "POST",
        wallet: activeWallet,
        json: { walletAddress: activeWallet },
      });
      fetchInvitations();
    } catch (err) {
      console.error("Failed to decline invitation:", err);
    }
  };

  return (
    <InvitationsContext.Provider
      value={{
        invitations,
        pendingCount,
        loading,
        isModalOpen,
        setIsModalOpen,
        refreshInvitations: fetchInvitations,
        declineInvitation,
      }}
    >
      {children}
    </InvitationsContext.Provider>
  );
}

export function useInvitations() {
  return useContext(InvitationsContext);
}
