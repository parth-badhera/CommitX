"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWeb3 } from "@/context/Web3Context";
import { useAuth } from "@/context/AuthContext";
import { useInvitations } from "@/context/InvitationsContext";
import { useProfile } from "@/context/ProfileContext";
import { Avatar } from "@/components/ui/Avatar";
import { ReputationBadge } from "@/components/reputation/Reputation";
import { shortenAddress } from "@/lib/formatters";
import {
  Wallet,
  AlertTriangle,
  ChevronDown,
  LogOut,
  Mail,
  LayoutGrid,
  Compass,
  Plus,
  ShieldCheck,
  UserRound,
  Sparkles,
  Copy,
  Check,
  Coins,
} from "lucide-react";

// Display-only: decides whether to show the Admin link. The contract enforces who can claim.
const ADMIN_WALLET = (process.env.NEXT_PUBLIC_TREASURY_ADDRESS || "").toLowerCase();

export function Logo({ className = "" }) {
  return (
    <Link href="/" className={`flex items-center gap-2 group ${className}`}>
      <span className="w-7 h-7 rounded-lg bg-lime text-ink grid place-items-center font-display font-extrabold text-sm leading-none transition-transform group-hover:rotate-12">
        X
      </span>
      <span className="font-display text-lg font-bold tracking-tight text-fg">
        Commit<span className="text-lime">X</span>
      </span>
    </Link>
  );
}

const NAV = [
  { name: "My challenges", href: "/dashboard" },
  { name: "Explore", href: "/explore" },
  { name: "Review", href: "/verify" },
  { name: "Learn", href: "/learn" },
];

export function Navbar() {
  const pathname = usePathname();
  const { chainId, balance, isSupportedChain, connectWallet, disconnectWallet, switchToSepolia, isConnecting } = useWeb3();
  const { user, openAuthModal, signOut } = useAuth();
  const { pendingCount, setIsModalOpen } = useInvitations();
  const { profile, wallet, reputation } = useProfile();

  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => setMenuOpen(false), [pathname]);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => menuRef.current && !menuRef.current.contains(e.target) && setMenuOpen(false);
    const esc = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menuOpen]);

  const isActive = (href) => pathname === href || pathname.startsWith(href + "/");
  const isAdmin = Boolean(ADMIN_WALLET && wallet === ADMIN_WALLET);
  const nav = isAdmin ? [...NAV, { name: "Admin", href: "/admin" }] : NAV;
  const bal = parseFloat(balance || "0");

  const copy = () => {
    navigator.clipboard.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <>
      {wallet && chainId && !isSupportedChain && (
        <div className="bg-warn text-ink text-xs font-medium px-4 py-2 flex items-center justify-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>Your wallet is on the wrong network. CommitX runs on Sepolia.</span>
          <button onClick={switchToSepolia} className="underline font-semibold">
            Switch
          </button>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-line bg-ink/80 backdrop-blur-xl">
        <div className="shell h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8">
            <Logo />
            <nav className="hidden md:flex items-center gap-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`h-9 px-3.5 rounded-full text-sm flex items-center transition ${
                    isActive(item.href) ? "bg-raised text-fg" : "text-dim hover:text-fg"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/create" className="btn-primary btn-sm hidden md:inline-flex">
              <Plus className="w-4 h-4" /> New challenge
            </Link>

            {wallet && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="relative w-9 h-9 rounded-full grid place-items-center text-dim hover:text-fg hover:bg-raised transition"
                aria-label="Invitations"
              >
                <Mail className="w-4 h-4" />
                {pendingCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-lime text-ink text-[10px] font-bold grid place-items-center num animate-pop">
                    {pendingCount}
                  </span>
                )}
              </button>
            )}

            {profile ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setMenuOpen((o) => !o)}
                  className="group h-10 pl-1 pr-2 sm:pr-3 rounded-full bg-raised border border-line hover:border-line-strong flex items-center gap-2 text-sm transition"
                  aria-expanded={menuOpen}
                  aria-label="Your account"
                >
                  <span className="group-hover:animate-wiggle">
                    <Avatar src={profile.avatar} seed={wallet || profile.name} size={32} />
                  </span>
                  <span className="hidden sm:block text-left leading-tight">
                    <span className="block text-fg font-medium max-w-[9rem] truncate">{profile.name}</span>
                    {wallet && <span className="block num text-[11px] text-faint">{bal.toFixed(3)} ETH</span>}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-faint transition-transform ${menuOpen ? "rotate-180" : ""}`} />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-72 card bg-panel p-2 shadow-2xl shadow-black/60 animate-slide-in">
                    <div className="p-3 flex items-center gap-3">
                      <Avatar src={profile.avatar} seed={wallet || profile.name} size={44} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-fg truncate flex items-center gap-1.5">
                          {profile.name} <ReputationBadge rep={reputation} compact />
                        </p>
                        {wallet ? (
                          <button onClick={copy} className="num text-xs text-faint hover:text-fg flex items-center gap-1">
                            {shortenAddress(wallet)}
                            {copied ? <Check className="w-3 h-3 text-ok" /> : <Copy className="w-3 h-3" />}
                          </button>
                        ) : (
                          <p className="text-xs text-faint truncate">{user?.email}</p>
                        )}
                      </div>
                    </div>
                    {wallet && (
                      <div className="mx-3 mb-2 px-3 py-2 rounded-xl bg-raised flex items-center justify-between text-xs">
                        <span className="text-dim">Balance</span>
                        <span className="num text-fg">{bal.toFixed(4)} ETH</span>
                      </div>
                    )}
                    <div className="h-px bg-line my-1" />
                    <MenuLink href="/profile" icon={Sparkles}>
                      My account
                    </MenuLink>
                    <MenuLink href="/dashboard" icon={LayoutGrid}>
                      My challenges
                    </MenuLink>
                    <MenuButton
                      icon={Mail}
                      onClick={() => {
                        setMenuOpen(false);
                        setIsModalOpen(true);
                      }}
                    >
                      Invitations
                      {pendingCount > 0 && <span className="ml-auto chip text-lime">{pendingCount}</span>}
                    </MenuButton>
                    {isAdmin && (
                      <MenuLink href="/admin" icon={Coins}>
                        Admin · fees
                      </MenuLink>
                    )}
                    {!wallet && (
                      <MenuButton
                        icon={Wallet}
                        onClick={() => {
                          setMenuOpen(false);
                          connectWallet();
                        }}
                      >
                        Connect wallet
                      </MenuButton>
                    )}
                    {!user && (
                      <MenuButton
                        icon={UserRound}
                        onClick={() => {
                          setMenuOpen(false);
                          openAuthModal(1);
                        }}
                      >
                        Sign in with Google <span className="ml-auto text-[10px] text-faint">optional</span>
                      </MenuButton>
                    )}
                    <div className="h-px bg-line my-1" />
                    <MenuButton
                      icon={LogOut}
                      danger
                      onClick={() => {
                        setMenuOpen(false);
                        disconnectWallet();
                        if (user) signOut();
                      }}
                    >
                      {user ? "Sign out" : "Disconnect"}
                    </MenuButton>
                  </div>
                )}
              </div>
            ) : (
              <button onClick={connectWallet} disabled={isConnecting} className="btn-primary btn-sm">
                <Wallet className="w-4 h-4" />
                {isConnecting ? "Connecting…" : "Connect wallet"}
              </button>
            )}
          </div>
        </div>
      </header>

      <MobileTabBar isActive={isActive} wallet={wallet} profile={profile} />
    </>
  );
}

/** App-style bottom navigation for phones. */
function MobileTabBar({ isActive, wallet, profile }) {
  const tabs = [
    { href: wallet ? "/dashboard" : "/", label: "Home", icon: LayoutGrid },
    { href: "/explore", label: "Explore", icon: Compass },
    { href: "/create", label: "Create", icon: Plus, primary: true },
    { href: "/verify", label: "Review", icon: ShieldCheck },
    { href: "/profile", label: "Account", icon: UserRound, me: true },
  ];
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-line bg-ink/90 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 h-16">
        {tabs.map((t) => {
          const active = t.href !== "/" && isActive(t.href);
          if (t.primary) {
            return (
              <Link key={t.href} href={t.href} className="grid place-items-center" aria-label="Create a challenge">
                <span className="w-12 h-12 -mt-5 rounded-2xl bg-lime text-ink grid place-items-center shadow-glow active:scale-95 transition">
                  <Plus className="w-6 h-6" strokeWidth={2.5} />
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center justify-center gap-1 text-[11px] transition ${
                active ? "text-lime" : "text-faint"
              }`}
            >
              {t.me && profile ? (
                <span className={`rounded-full ${active ? "ring-2 ring-lime" : ""}`}>
                  <Avatar src={profile.avatar} seed={wallet || profile.name} size={22} />
                </span>
              ) : (
                <t.icon className="w-5 h-5" />
              )}
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function MenuLink({ href, icon: Icon, children }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-dim hover:text-fg hover:bg-raised transition">
      <Icon className="w-4 h-4" />
      {children}
    </Link>
  );
}

function MenuButton({ icon: Icon, children, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition text-left ${
        danger ? "text-bad hover:bg-bad/10" : "text-dim hover:text-fg hover:bg-raised"
      }`}
    >
      <Icon className="w-4 h-4" />
      {children}
    </button>
  );
}
