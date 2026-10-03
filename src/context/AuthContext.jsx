"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

// The Supabase SDK is loaded after first paint — it isn't needed to render any page.
let clientPromise = null;
const getSupabase = () => {
  if (!clientPromise) clientPromise = import("@/utils/supabase/client").then((m) => m.createClient());
  return clientPromise;
};

const readDemoUser = () => {
  try {
    const saved = localStorage.getItem("commitx_demo_user");
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authStep, setAuthStep] = useState(1); // 1 = Google, 2 = MetaMask

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (data.authenticated && data.user) {
        setUser(data.user);
      } else {
        const saved = readDemoUser();
        if (!saved) {
          setUser(null);
        } else {
          // Re-validate: the stored demo account may no longer exist (e.g. after a database reset)
          const r = await fetch("/api/auth/demo-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: saved.email, name: saved.name }),
          }).catch(() => null);
          const fresh = r && r.ok ? (await r.json()).user : null;
          if (fresh) {
            try {
              localStorage.setItem("commitx_demo_user", JSON.stringify(fresh));
            } catch {}
          } else {
            try {
              localStorage.removeItem("commitx_demo_user");
            } catch {}
          }
          setUser(fresh);
        }
      }
    } catch (err) {
      console.error("Failed to load session:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();

    let subscription = null;
    let cancelled = false;
    getSupabase().then((supabase) => {
      if (cancelled) return;
      ({
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event) => {
        if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "TOKEN_REFRESHED") {
          await fetchSession();
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          try {
            localStorage.removeItem("commitx_demo_user");
          } catch {}
        }
      }));
    });

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, [fetchSession]);

  const signInWithGoogle = async () => {
    try {
      const supabase = await getSupabase();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      return data;
    } catch (err) {
      console.error("Google sign-in error:", err);
      throw err;
    }
  };

  const signInWithDemo = async (email = "alex.rivera@gmail.com", name = "Alex Rivera") => {
    try {
      const res = await fetch("/api/auth/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        if (typeof window !== "undefined") {
          localStorage.setItem("commitx_demo_user", JSON.stringify(data.user));
        }
        return data.user;
      }
      throw new Error(data.error || "Demo sign in failed");
    } catch (err) {
      console.error("Demo login error:", err);
      throw err;
    }
  };

  const signOut = async () => {
    try {
      await (await getSupabase()).auth.signOut();
      if (typeof window !== "undefined") {
        localStorage.removeItem("commitx_demo_user");
      }
      setUser(null);
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  /** sign(message) → signature; proves the caller owns the wallet being linked. */
  const linkWallet = async (walletAddress, sign) => {
    if (!user) throw new Error("Sign in first, then link your wallet.");
    if (!walletAddress) throw new Error("Wallet address is required");

    const nonce = `CommitX Auth: Link wallet ${walletAddress.toLowerCase()} to ${
      user.email
    } at ${new Date().toISOString()}`;
    const signature = await sign(nonce);

    const res = await fetch("/api/auth/link-wallet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        walletAddress,
        signature,
        nonce,
        demoUserId: user.isDemo ? user.id : undefined,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || "Failed to link wallet");
    }

    const updatedUser = {
      ...user,
      walletAddress: data.user.walletAddress,
    };
    setUser(updatedUser);
    if (user.isDemo && typeof window !== "undefined") {
      localStorage.setItem("commitx_demo_user", JSON.stringify(updatedUser));
    }
    return updatedUser;
  };

  const unlinkWallet = async () => {
    if (!user) return;
    try {
      const res = await fetch("/api/auth/unlink-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          demoUserId: user.isDemo ? user.id : undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        const updated = { ...user, walletAddress: null };
        setUser(updated);
        if (user.isDemo && typeof window !== "undefined") {
          localStorage.setItem("commitx_demo_user", JSON.stringify(updated));
        }
      }
    } catch (err) {
      console.error("Failed to unlink wallet:", err);
    }
  };

  const openAuthModal = (step = 1) => {
    setAuthStep(step);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isGoogleAuthenticated: Boolean(user),
        isAuthModalOpen,
        authStep,
        setAuthStep,
        openAuthModal,
        closeAuthModal,
        signInWithGoogle,
        signInWithDemo,
        signOut,
        linkWallet,
        unlinkWallet,
        refreshSession: fetchSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
