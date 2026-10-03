"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useWeb3 } from "@/context/Web3Context";
import { useAuth } from "@/context/AuthContext";
import { useInvitations } from "@/context/InvitationsContext";
import { useProfile, ACCENTS } from "@/context/ProfileContext";
import { ReputationBadge, SuspendedBanner } from "@/components/reputation/Reputation";
import { useToast } from "@/context/ToastContext";
import { formatEth, shortenAddress } from "@/lib/formatters";
import { defaultName } from "@/lib/identity";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Segmented, EmptyState, CountUp, EthCountUp, Spinner, ProgressRing } from "@/components/ui/primitives";
import { confetti } from "@/lib/confetti";
import { Wallet, Copy, Check, Flame, Mail, ArrowUpRight, Shuffle, Dices, Link2, Unlink, UserRound } from "lucide-react";

const randomSeed = () => Math.random().toString(36).slice(2, 10);

export default function ProfilePage() {
  const { connectWallet, balance, isConnecting } = useWeb3();
  const { user, openAuthModal, unlinkWallet } = useAuth();
  const { invitations, pendingCount, declineInvitation } = useInvitations();
  const { profile, wallet, reputation, updateProfile, accent, setAccent } = useProfile();
  const toast = useToast();

  const [tab, setTab] = useState("enrolled");
  const [challenges, setChallenges] = useState([]);
  const [copied, setCopied] = useState(false);

  // Editable profile draft
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [seeds, setSeeds] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name || "");
    setAvatar(profile.avatar || (wallet ? `gen:${wallet.slice(2)}` : null));
  }, [profile, wallet]);

  useEffect(() => {
    if (wallet) setSeeds([wallet.slice(2), ...Array.from({ length: 10 }, (_, i) => `${wallet.slice(2, 10)}${i}`)]);
  }, [wallet]);

  useEffect(() => {
    if (!wallet) return setChallenges([]);
    fetch(`/api/challenges?visibility=All&userAddress=${wallet}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setChallenges(d.challenges || []))
      .catch(() => {});
  }, [wallet]);

  const enrolled = challenges.filter((c) => c.participants?.some((p) => p.walletAddress?.toLowerCase() === wallet));
  const created = challenges.filter((c) => c.creatorAddress?.toLowerCase() === wallet);
  const stats = useMemo(() => {
    let done = 0;
    let possible = 0;
    let staked = 0n;
    for (const c of enrolled) {
      staked += BigInt(c.stakeAmountWei || "0");
      const p = c.participants.find((x) => x.walletAddress?.toLowerCase() === wallet);
      if (p) {
        done += p.completedPeriods || 0;
        possible += c.totalPeriods || 1;
      }
    }
    return { done, possible, staked, rate: possible ? Math.round((done / possible) * 100) : 0 };
  }, [enrolled, wallet]);

  const googlePhoto = user?.avatar && /^https:\/\//.test(user.avatar) ? user.avatar : null;
  const dirty = profile && (name.trim() !== profile.name || (avatar || null) !== (profile.avatar || (wallet ? `gen:${wallet.slice(2)}` : null)));

  const save = async () => {
    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), avatar });
      toast.success("Profile saved", "Looking good.");
      confetti({ y: 0.25, count: 60 });
    } catch (err) {
      toast.error("Couldn't save", err.message);
    } finally {
      setSaving(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(wallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!wallet && !user) {
    return (
      <div className="shell py-12">
        <EmptyState
          icon={UserRound}
          title="Make CommitX yours"
          body="Connect your wallet to pick an avatar, choose a name your group will see, and track your record."
          action={
            <button onClick={connectWallet} disabled={isConnecting} className="btn-primary">
              <Wallet className="w-4 h-4" /> Connect wallet
            </button>
          }
        />
      </div>
    );
  }

  const list = tab === "enrolled" ? enrolled : tab === "created" ? created : null;

  return (
    <div className="shell py-10 space-y-10">
      {/* ---------- Identity editor ---------- */}
      <section className="card-glow p-6 sm:p-8 grid lg:grid-cols-[auto_1fr] gap-8 animate-fade-up">
        <div className="flex flex-col items-center gap-3">
          <span key={avatar} className="rounded-full ring-4 ring-lime/25 animate-pop">
            <Avatar src={avatar} seed={wallet || name} size={120} />
          </span>
          <p className="text-lg font-semibold text-fg text-center max-w-[12rem] truncate">{name || "Your name"}</p>
          {wallet && (
            <button onClick={copy} className="num text-xs text-faint hover:text-fg flex items-center gap-1">
              {shortenAddress(wallet)}
              {copied ? <Check className="w-3 h-3 text-ok" /> : <Copy className="w-3 h-3" />}
            </button>
          )}
        </div>

        <div className="space-y-6 min-w-0">
          <div>
            <h1 className="text-3xl font-bold text-fg">My account</h1>
            <p className="text-sm text-dim mt-1">This is how your group sees you in challenges and reviews.</p>
          </div>

          {wallet ? (
            <>
              <div>
                <label className="label" htmlFor="display-name">
                  Display name
                </label>
                <div className="flex gap-2">
                  <input
                    id="display-name"
                    value={name}
                    maxLength={24}
                    onChange={(e) => setName(e.target.value)}
                    className="input"
                    placeholder={defaultName(wallet)}
                  />
                  <button
                    type="button"
                    onClick={() => setName(defaultName(randomSeed()))}
                    className="btn-secondary shrink-0 px-3"
                    title="Random name"
                    aria-label="Suggest a random name"
                  >
                    <Dices className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="label mb-0">Avatar</p>
                  <button
                    type="button"
                    onClick={() => setSeeds((s) => [s[0], ...Array.from({ length: 10 }, randomSeed)])}
                    className="text-xs text-dim hover:text-fg flex items-center gap-1"
                  >
                    <Shuffle className="w-3.5 h-3.5" /> Shuffle
                  </button>
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
                  {googlePhoto && (
                    <AvatarOption selected={avatar === googlePhoto} onClick={() => setAvatar(googlePhoto)} label="Google photo">
                      <Avatar src={googlePhoto} size={44} />
                    </AvatarOption>
                  )}
                  {seeds.map((s) => (
                    <AvatarOption key={s} selected={avatar === `gen:${s}`} onClick={() => setAvatar(`gen:${s}`)} label="Generated avatar">
                      <Avatar src={`gen:${s}`} size={44} />
                    </AvatarOption>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button onClick={save} disabled={!dirty || saving || name.trim().length < 2} className="btn-primary">
                  {saving ? <Spinner /> : <Check className="w-4 h-4" />} Save profile
                </button>
                {dirty && <span className="text-xs text-faint animate-fade-in">Unsaved changes</span>}
              </div>
            </>
          ) : (
            <div className="well p-4 flex items-center justify-between gap-3">
              <p className="text-sm text-dim">Connect a wallet to choose your avatar and name.</p>
              <button onClick={connectWallet} className="btn-primary btn-sm">
                Connect
              </button>
            </div>
          )}

          <div>
            <p className="label">App colour</p>
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAccent(a.id)}
                  className={`h-9 pl-1.5 pr-3 rounded-full border flex items-center gap-2 text-xs transition ${
                    accent === a.id ? "border-fg text-fg" : "border-line text-dim hover:text-fg"
                  }`}
                >
                  <span className="w-6 h-6 rounded-full grid place-items-center" style={{ background: `rgb(${a.rgb})` }}>
                    {accent === a.id && <Check className="w-3.5 h-3.5 text-ink animate-pop" strokeWidth={3} />}
                  </span>
                  {a.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-faint mt-2">Saved on this device. Changes the whole app instantly.</p>
          </div>
        </div>
      </section>

      {/* ---------- Reputation ---------- */}
      {wallet && reputation && (
        <section className="space-y-3">
          <SuspendedBanner rep={reputation} />
          <div className="card p-6 grid sm:grid-cols-[auto_1fr] gap-6 items-center">
            <ProgressRing
              value={reputation.score}
              size={96}
              stroke={8}
              tone={reputation.level === "Trusted" ? "ok" : reputation.suspended || reputation.level === "At risk" ? "violet" : "lime"}
            >
              <span className="text-center">
                <span className="num block text-2xl font-semibold text-fg leading-none">{reputation.score}</span>
                <span className="block text-[10px] text-faint mt-1">/ 100</span>
              </span>
            </ProgressRing>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold text-fg">Reputation</h2>
                <ReputationBadge rep={reputation} />
              </div>
              <p className="text-sm text-dim leading-relaxed">
                Your reputation shows how fair you are. Everyone starts at 100 and earns +2 for every review. If the admin upholds
                a complaint about your vote — or rules a complaint you filed false — you lose 10. Below 25 your account is
                suspended (no joining, creating, submitting or reviewing) and recovers +2 every 4 days until it&apos;s back to 25.
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="chip">
                  <span className="num text-fg">{reputation.votes}</span> reviews
                </span>
                <span className="chip">
                  <span className="num text-fg">{reputation.upheld}</span> upheld complaints
                </span>
                {reputation.open > 0 && (
                  <span className="chip text-warn border-warn/25 bg-warn/10">
                    <span className="num">{reputation.open}</span> under review
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---------- Record ---------- */}
      {wallet && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <RecordCard label="Completion" value={<CountUp value={stats.rate} format={(n) => `${Math.round(n)}%`} />} hint={`${stats.done} of ${stats.possible} periods`} accent />
          <RecordCard label="Total staked" value={<EthCountUp wei={stats.staked} />} />
          <RecordCard label="Settled" value={<CountUp value={enrolled.filter((c) => c.status === "FINALIZED").length} />} />
          <RecordCard label="Created" value={<CountUp value={created.length} />} hint={`Balance ${parseFloat(balance || "0").toFixed(3)} ETH`} />
        </section>
      )}

      {/* ---------- Account ---------- */}
      <section className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <UserRound className="w-5 h-5 text-dim" />
          <div>
            <p className="text-sm font-medium text-fg">{user ? `Signed in as ${user.email}` : "Google sign-in (optional)"}</p>
            <p className="text-xs text-faint">
              {user ? "Your wallet and Google account are linked." : "Link Google to get your photo and sign in on other devices."}
            </p>
          </div>
        </div>
        {user ? (
          user.walletAddress ? (
            <button onClick={unlinkWallet} className="btn-ghost btn-sm">
              <Unlink className="w-3.5 h-3.5" /> Unlink wallet
            </button>
          ) : (
            <button onClick={() => openAuthModal(2)} className="btn-secondary btn-sm">
              <Link2 className="w-3.5 h-3.5" /> Link wallet
            </button>
          )
        ) : (
          <button onClick={() => openAuthModal(1)} className="btn-secondary btn-sm">
            Sign in with Google
          </button>
        )}
      </section>

      {/* ---------- Lists ---------- */}
      {wallet && (
        <section className="space-y-4">
          <Segmented
            items={[
              { id: "enrolled", label: `Joined · ${enrolled.length}` },
              { id: "created", label: `Created · ${created.length}` },
              { id: "invites", label: `Invitations${pendingCount ? ` · ${pendingCount}` : ""}` },
            ]}
            value={tab}
            onChange={setTab}
          />

          {list &&
            (list.length === 0 ? (
              <EmptyState
                icon={Flame}
                title={tab === "enrolled" ? "You haven't joined anything yet" : "You haven't created anything yet"}
                action={
                  <Link href={tab === "enrolled" ? "/explore" : "/create"} className="btn-primary">
                    {tab === "enrolled" ? "Explore challenges" : "Create a challenge"}
                  </Link>
                }
              />
            ) : (
              <div className="card divide-y divide-line overflow-hidden">
                {list.map((c) => (
                  <Link
                    key={c.id}
                    href={`/challenges/${c.contractChallengeId}`}
                    className="group p-5 flex items-center gap-4 hover:bg-raised/40 transition"
                  >
                    <div className="min-w-0 flex-1 space-y-1">
                      <StatusBadge status={c.status} />
                      <p className="font-medium text-fg truncate group-hover:text-lime transition">{c.name}</p>
                      <p className="text-xs text-dim">
                        <span className="num">{formatEth(c.stakeAmountWei)}</span> · every {c.submissionFrequency || 1}d ·{" "}
                        <span className="num">
                          {c.participants?.length || 0}/{c.maxParticipants}
                        </span>{" "}
                        joined
                      </p>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-faint group-hover:text-lime transition" />
                  </Link>
                ))}
              </div>
            ))}

          {tab === "invites" &&
            (invitations.length === 0 ? (
              <EmptyState icon={Mail} title="No invitations" body="Private challenges you're invited to will appear here." />
            ) : (
              <div className="card divide-y divide-line overflow-hidden">
                {invitations.map((inv) => {
                  const c = inv.challenge;
                  const pending = inv.status === "PENDING" && !inv.isEnrolled && !inv.isExpired;
                  const accepted = inv.status === "ACCEPTED" || inv.isEnrolled;
                  return (
                    <div key={inv.id} className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Avatar seed={inv.invitedBy} size={36} />
                        <div className="min-w-0">
                          <p className="font-medium text-fg truncate">{c.name}</p>
                          <p className="text-xs text-dim">
                            from <span className="num">{shortenAddress(inv.invitedBy)}</span> · <span className="num">{formatEth(c.stakeAmountWei)}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {pending && (
                          <button onClick={() => declineInvitation(inv.id)} className="btn-ghost btn-sm">
                            Decline
                          </button>
                        )}
                        <Link
                          href={accepted ? `/challenges/${c.contractChallengeId}` : `/challenges/${c.contractChallengeId}?invite=${inv.inviteToken}`}
                          className={`${pending ? "btn-primary" : "btn-secondary"} btn-sm`}
                        >
                          {accepted ? "Open" : "Review & join"}
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
        </section>
      )}
    </div>
  );
}

function AvatarOption({ selected, onClick, label, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      className={`relative rounded-full transition hover:scale-110 active:scale-95 ${
        selected ? "ring-2 ring-lime ring-offset-2 ring-offset-panel" : "opacity-80 hover:opacity-100"
      }`}
    >
      {children}
      {selected && (
        <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-lime text-ink grid place-items-center animate-pop">
          <Check className="w-2.5 h-2.5" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

function RecordCard({ label, value, hint, accent }) {
  return (
    <div className={`card p-5 space-y-2 ${accent ? "border-lime/30" : ""}`}>
      <p className="eyebrow">{label}</p>
      <p className={`num text-2xl sm:text-3xl font-semibold ${accent ? "text-lime" : "text-fg"}`}>{value}</p>
      {hint && <p className="text-xs text-faint">{hint}</p>}
    </div>
  );
}
