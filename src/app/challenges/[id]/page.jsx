"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useWeb3 } from "@/context/Web3Context";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { apiFetch, retry } from "@/lib/api";
import { EXPLORER, getWriteContract, readPosition, friendlyTxError } from "@/lib/chain";
import { deploymentFor, feeFor, netStakeFor, FEE_PERCENT_LABEL } from "@/lib/network";
import { formatEth, shortenAddress, formatDate, formatTimeLeft, getRequiredApprovals } from "@/lib/formatters";
import { StatusBadge, Badge } from "@/components/ui/Badge";
import { Avatar, AvatarStack, peopleFromParticipants } from "@/components/ui/Avatar";
import { displayName } from "@/lib/identity";
import { confetti } from "@/lib/confetti";
import { useProfile } from "@/context/ProfileContext";
import {
  ReputationBadge,
  useReputations,
  ReportDialog,
  SuspendedBanner,
  RemovedBanner,
} from "@/components/reputation/Reputation";
import {
  Progress,
  Row,
  Segmented,
  EmptyState,
  Spinner,
  CategoryTile,
  Countdown,
  InfoTip,
} from "@/components/ui/primitives";
import {
  ArrowLeft,
  Lock,
  Globe,
  Copy,
  Check,
  ExternalLink,
  Coins,
  CheckCircle2,
  Send,
  ShieldCheck,
  UserPlus,
  Clock,
  Upload,
  AlertTriangle,
  Gavel,
  RefreshCw,
  Flag,
} from "lucide-react";

export default function ChallengeDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const challengeId = params.id;
  const inviteToken = searchParams.get("invite");

  const { account, connectWallet, setTxState, updateAccountAndBalance, authenticateWithWallet } = useWeb3();
  const { user } = useAuth();
  const { reputation: myReputation } = useProfile();
  const [reportTarget, setReportTarget] = useState(null);
  const toast = useToast();
  const wallet = (account || user?.walletAddress || "").toLowerCase() || null;

  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState(() => searchParams.get("tab") || "overview");

  // On-chain position of the connected wallet
  const [position, setPosition] = useState(null); // { claimable, hasWithdrawn, isParticipant }
  const [positionLoading, setPositionLoading] = useState(false);

  // Proof form
  const [periodId, setPeriodId] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [proofUri, setProofUri] = useState("");
  const [submittingProof, setSubmittingProof] = useState(false);
  const [proofSent, setProofSent] = useState(false);

  const [votingId, setVotingId] = useState(null);
  const [inviteWallet, setInviteWallet] = useState("");
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(null);

  const fetchChallenge = useCallback(
    async (fresh = false) => {
      try {
        const res = await fetch(`/api/challenges/${challengeId}${fresh ? "?fresh=1" : ""}`, { cache: "no-store" });
        const data = await res.json();
        if (data.challenge) setChallenge(data.challenge);
      } catch (err) {
        console.error("Error fetching challenge:", err);
      } finally {
        setLoading(false);
      }
    },
    [challengeId]
  );

  useEffect(() => {
    fetchChallenge();
  }, [fetchChallenge]);

  const onChainId = challenge?.contractChallengeId;

  const refreshPosition = useCallback(async () => {
    if (!wallet || onChainId === undefined) return;
    setPositionLoading(true);
    try {
      setPosition(await readPosition(onChainId, wallet));
    } catch (err) {
      console.error("Failed to read on-chain position:", err);
    } finally {
      setPositionLoading(false);
    }
  }, [wallet, onChainId]);

  useEffect(() => {
    setPosition(null);
    refreshPosition();
  }, [refreshPosition]);

  // Enrolled on-chain but missing from the DB → backfill once (never loop on failure)
  const backfilled = useRef(new Set());
  useEffect(() => {
    if (!position?.isParticipant || !challenge || !wallet) return;
    const key = `${challenge.contractChallengeId}:${wallet}`;
    const inDb = challenge.participants?.some((p) => p.walletAddress.toLowerCase() === wallet);
    if (inDb || backfilled.current.has(key)) return;
    backfilled.current.add(key);
    apiFetch(`/api/challenges/${challenge.contractChallengeId}/join`, {
      method: "POST",
      json: { walletAddress: wallet },
    })
      .then(() => fetchChallenge())
      .catch(() => {});
  }, [position?.isParticipant, challenge, wallet, fetchChallenge]);

  // Periods that accept proof right now and don't have one from this wallet yet
  const openPeriods = useMemo(() => {
    if (!challenge?.periods) return [];
    const now = Date.now();
    return challenge.periods.filter(
      (p) =>
        now >= new Date(p.startTime).getTime() &&
        now < new Date(p.endTime).getTime() &&
        !p.proofs?.some((pr) => pr.participantAddress.toLowerCase() === wallet)
    );
  }, [challenge, wallet]);

  useEffect(() => {
    if (!openPeriods.some((p) => p.id === periodId)) setPeriodId(openPeriods[0]?.id || "");
  }, [openPeriods, periodId]);

  const reps = useReputations(challenge?.participants?.map((p) => p.walletAddress) || []);

  const derived = useMemo(() => {
    if (!challenge) return null;
    const now = Date.now();
    const start = new Date(challenge.startTime).getTime();
    const end = new Date(challenge.endTime).getTime();
    const periods = challenge.periods || [];
    const currentPeriod = periods.find((p) => now >= new Date(p.startTime) && now < new Date(p.endTime));
    return {
      now,
      beforeStart: now < start,
      running: now >= start && now < end,
      ended: now >= end,
      currentPeriod,
      elapsedPct: Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100)),
    };
  }, [challenge]);

  if (loading) {
    return (
      <div className="shell py-32 flex justify-center text-dim">
        <Spinner className="w-6 h-6" />
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="shell py-24">
        <EmptyState
          title="Challenge not found"
          body="It doesn't exist, or it hasn't been synced from the chain yet."
          action={
            <Link href="/explore" className="btn-secondary">
              Back to explore
            </Link>
          }
        />
      </div>
    );
  }

  // ---------- derived state ----------
  const participants = challenge.participants || [];
  const participantCount = participants.length;
  const creator = participants.find((p) => p.walletAddress.toLowerCase() === challenge.creatorAddress.toLowerCase());
  const me = wallet ? participants.find((p) => p.walletAddress.toLowerCase() === wallet) : null;
  const isCreator = wallet && wallet === challenge.creatorAddress.toLowerCase();
  const isEnrolled = Boolean(me || position?.isParticipant);
  const isFull = participantCount >= challenge.maxParticipants;
  const requiredApprovals = getRequiredApprovals(participantCount);
  const totalPeriods = challenge.totalPeriods || 1;
  const myCompleted = me?.completedPeriods || 0;
  const myPct = Math.round((myCompleted / totalPeriods) * 100);
  const claimable = BigInt(position?.claimable || "0");
  // Admin lock (only enforced by contracts that support it)
  // Admin penalties: removed from this challenge, or suspended everywhere (reputation < 25)
  const iAmRemoved = Boolean(me?.disqualifiedAt);
  const iAmSuspended = Boolean(myReputation?.suspended);
  const canAct = isEnrolled && !iAmRemoved && !iAmSuspended;
  const status = challenge.status;

  const canJoin = status === "OPEN" && derived.beforeStart && !isEnrolled && !isFull;
  const authorizedForPrivate =
    !challenge.isPrivate ||
    isCreator ||
    Boolean(inviteToken) ||
    challenge.invitations?.some((inv) => inv.walletAddress?.toLowerCase() === wallet && inv.status !== "REVOKED");
  const isClosed = status === "FINALIZED" || status === "CANCELLED";
  // The contract allows a full-refund cancel once the start time passes with fewer than 2 people
  // (its live status then reads ACTIVE/VERIFICATION, so don't gate on "OPEN")
  // Started with fewer than 2 people: it can't run, so whoever joined takes their stake back
  // minus the non-refundable joining fee (there is no cancellation)
  const canRefund = !isClosed && !derived.beforeStart && participantCount < 2;
  const deployment = deploymentFor(challenge.contractChallengeId);
  const feeWei = feeFor(challenge.stakeAmountWei, challenge.contractChallengeId);
  const netWei = netStakeFor(challenge.stakeAmountWei, challenge.contractChallengeId);
  const canSettle = !isClosed && derived.ended && participantCount >= 2;

  const peerProofs = (challenge.periods || [])
    .flatMap((p) => (p.proofs || []).map((pr) => ({ ...pr, periodNumber: p.periodNumber })))
    .filter((pr) => pr.participantAddress.toLowerCase() !== wallet);

  const myProofs = (challenge.periods || [])
    .flatMap((p) => (p.proofs || []).map((pr) => ({ ...pr, periodNumber: p.periodNumber })))
    .filter((pr) => pr.participantAddress.toLowerCase() === wallet);

  const pendingReviews = peerProofs.filter(
    (pr) => !pr.verifications?.some((v) => v.verifierAddress.toLowerCase() === wallet)
  ).length;

  // ---------- actions ----------
  const requireWallet = () => {
    if (!account) {
      connectWallet();
      return false;
    }
    return true;
  };

  const afterTx = async () => {
    await fetchChallenge(true);
    await refreshPosition();
    if (account) updateAccountAndBalance(account);
  };

  const handleJoin = async () => {
    if (!requireWallet()) return;
    try {
      setTxState({ status: "preparing", title: "Joining challenge", txHash: null, error: null });
      const protocol = await getWriteContract(challenge.contractChallengeId);

      if (await protocol.isParticipant(challenge.contractChallengeId, account)) {
        await fetch(`/api/challenges/${challenge.contractChallengeId}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: account, txHash: "on-chain-already-enrolled" }),
        }).catch(() => {});
        await afterTx();
        setTxState({ status: "confirmed", title: "You're already in this challenge", txHash: null, error: null });
        return;
      }

      const value = BigInt(challenge.stakeAmountWei);
      let tx;
      if (challenge.isPrivate && !isCreator) {
        const authRes = await fetch(`/api/challenges/${challenge.contractChallengeId}/authorize-join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: account, inviteToken }),
        });
        const auth = await authRes.json();
        if (!authRes.ok || !auth.authorized)
          throw new Error(auth.error || "You're not authorized to join this private challenge.");
        setTxState({ status: "waiting_wallet", title: "Confirm your stake", txHash: null, error: null });
        tx = await protocol.joinChallengeWithAuthorization(challenge.contractChallengeId, auth.signature, { value });
      } else {
        setTxState({ status: "waiting_wallet", title: "Confirm your stake", txHash: null, error: null });
        tx = await protocol.joinChallenge(challenge.contractChallengeId, { value });
      }

      setTxState({ status: "submitted", title: "Staking…", txHash: tx.hash, error: null });
      await tx.wait();

      // The public RPC can lag the wallet's node by a few seconds — retry until it sees the join
      await retry(() =>
        apiFetch(`/api/challenges/${challenge.contractChallengeId}/join`, {
          method: "POST",
          json: { walletAddress: account, txHash: tx.hash, inviteToken },
        })
      ).catch((err) => console.warn("Join record will sync later:", err.message));

      setTxState({ status: "confirmed", title: "You're in. Good luck!", txHash: tx.hash, error: null });
      await afterTx();
    } catch (err) {
      console.error("Join error:", err);
      setTxState({ status: "failed", title: "Couldn't join", txHash: null, error: friendlyTxError(err) });
    }
  };

  const handleSettle = async () => {
    if (!requireWallet()) return;
    try {
      setTxState({ status: "preparing", title: "Settling challenge", txHash: null, error: null });
      const res = await fetch(`/api/attestation/${challenge.contractChallengeId}`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        // Already settled on-chain: the DB just caught up — show the withdraw button
        if (/already settled|cancelled/i.test(data.error)) {
          await afterTx();
          setTxState({ status: "confirmed", title: "Already settled", txHash: null, error: null });
          return;
        }
        throw new Error(data.error);
      }

      const { canonicalAddresses, completedPeriods, signature, settlementNonce } = data.attestation;
      const protocol = await getWriteContract(challenge.contractChallengeId);
      setTxState({ status: "waiting_wallet", title: "Confirm settlement", txHash: null, error: null });
      const tx = await protocol.finalizeChallenge(
        challenge.contractChallengeId,
        settlementNonce,
        canonicalAddresses,
        completedPeriods,
        signature
      );
      setTxState({ status: "submitted", title: "Settling on-chain…", txHash: tx.hash, error: null });
      await tx.wait();
      setTxState({ status: "confirmed", title: "Settled — payouts are ready", txHash: tx.hash, error: null });
      await afterTx();
    } catch (err) {
      console.error("Settlement error:", err);
      const msg = friendlyTxError(err);
      if (/already settled/i.test(msg)) await afterTx();
      setTxState({ status: "failed", title: "Settlement failed", txHash: null, error: msg });
    }
  };

  const handleWithdraw = async () => {
    if (!requireWallet()) return;
    try {
      setTxState({ status: "preparing", title: "Withdrawing payout", txHash: null, error: null });
      const protocol = await getWriteContract(challenge.contractChallengeId);
      // Dry-run first so a revert shows a clear reason instead of a gas-estimation error
      await protocol.withdraw.staticCall(challenge.contractChallengeId);
      setTxState({ status: "waiting_wallet", title: "Confirm withdrawal", txHash: null, error: null });
      const tx = await protocol.withdraw(challenge.contractChallengeId);
      setTxState({ status: "submitted", title: "Withdrawing…", txHash: tx.hash, error: null });
      await tx.wait();
      setTxState({
        status: "confirmed",
        title: `${formatEth(claimable)} sent to your wallet`,
        txHash: tx.hash,
        error: null,
      });
      await afterTx();
    } catch (err) {
      console.error("Withdraw error:", err);
      setTxState({ status: "failed", title: "Withdrawal failed", txHash: null, error: friendlyTxError(err) });
      refreshPosition();
    }
  };

  const handleRefund = async () => {
    if (!requireWallet()) return;
    try {
      setTxState({ status: "preparing", title: "Getting your stake back", txHash: null, error: null });
      const protocol = await getWriteContract(challenge.contractChallengeId);
      setTxState({ status: "waiting_wallet", title: "Confirm in MetaMask", txHash: null, error: null });
      const tx = await protocol.claimUnderfilledRefund(challenge.contractChallengeId);
      setTxState({ status: "submitted", title: "Processing…", txHash: tx.hash, error: null });
      await tx.wait();
      setTxState({
        status: "confirmed",
        title: `${formatEth(netWei)} sent to your wallet`,
        txHash: tx.hash,
        error: null,
      });
      await afterTx();
    } catch (err) {
      setTxState({ status: "failed", title: "Refund failed", txHash: null, error: friendlyTxError(err) });
    }
  };

  const handleSubmitProof = async (e) => {
    e.preventDefault();
    if (!wallet) return connectWallet();
    setSubmittingProof(true);
    try {
      await apiFetch("/api/proofs", {
        method: "POST",
        wallet,
        json: { periodId, participantAddress: wallet, contentUri: proofUri, note: proofNote },
      });
      setProofNote("");
      setProofUri("");
      setProofSent(true);
      confetti({ count: 70 });
      fetchChallenge();
    } catch (err) {
      toast.error("Couldn't submit proof", err.message);
    } finally {
      setSubmittingProof(false);
    }
  };

  const handleVote = async (proofId, decision) => {
    if (!wallet) return connectWallet();
    setVotingId(proofId);
    try {
      await apiFetch("/api/verifications", {
        method: "POST",
        wallet,
        json: { proofId, verifierAddress: wallet, decision, reason: `Peer reviewed by ${shortenAddress(wallet)}` },
      });
      toast.success(decision === "APPROVE" ? "Approved" : "Rejected", "Your vote is recorded.");
      fetchChallenge();
    } catch (err) {
      toast.error("Couldn't record vote", err.message);
    } finally {
      setVotingId(null);
    }
  };

  const handleAddInvite = async (e) => {
    e.preventDefault();
    if (!inviteWallet || !isCreator) return;
    setInviting(true);
    try {
      await apiFetch(`/api/challenges/${challenge.contractChallengeId}/invitations`, {
        method: "POST",
        wallet,
        json: { creatorAddress: wallet, walletAddress: inviteWallet },
      });
      try {
        const protocol = await getWriteContract(challenge.contractChallengeId);
        const tx = await protocol.whitelistParticipants(challenge.contractChallengeId, [inviteWallet.toLowerCase()]);
        await tx.wait();
      } catch (onChainErr) {
        console.warn("On-chain whitelist notice:", onChainErr);
      }
      toast.success("Invite added", shortenAddress(inviteWallet));
      setInviteWallet("");
      fetchChallenge();
    } catch (err) {
      toast.error("Couldn't add invite", err.message);
    } finally {
      setInviting(false);
    }
  };

  const handleRevokeInvite = async (inviteId, invitee) => {
    if (!isCreator) return;
    try {
      await apiFetch(
        `/api/challenges/${challenge.contractChallengeId}/invitations/${inviteId}?creatorAddress=${wallet}`,
        {
          method: "DELETE",
          wallet,
        }
      );
      if (invitee) {
        try {
          const protocol = await getWriteContract(challenge.contractChallengeId);
          const tx = await protocol.revokeWhitelist(challenge.contractChallengeId, invitee.toLowerCase());
          await tx.wait();
        } catch (rErr) {
          console.warn("On-chain revoke notice:", rErr);
        }
      }
      fetchChallenge();
    } catch (err) {
      toast.error("Couldn't revoke invite", err.message);
    }
  };

  const copy = (key, text) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const masterToken = challenge.invitations?.find((inv) => !inv.walletAddress)?.inviteToken;
  const inviteUrl =
    typeof window !== "undefined" && masterToken
      ? `${window.location.origin}/challenges/${challenge.contractChallengeId}?invite=${masterToken}`
      : "";

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "progress", label: "Progress" },
    ...(isEnrolled && !iAmRemoved ? [{ id: "submit", label: "Submit proof" }] : []),
    { id: "review", label: `Review${pendingReviews ? ` · ${pendingReviews}` : ""}` },
    { id: "people", label: `People · ${participantCount}` },
    ...(challenge.isPrivate && isCreator ? [{ id: "invites", label: "Invites" }] : []),
  ];

  const activeTab = tabs.some((t) => t.id === tab) ? tab : "overview";

  // 0 join · 1 prove & review · 2 settle · 3 withdraw · 4 done
  const journeyStage =
    status === "FINALIZED"
      ? position?.hasWithdrawn || claimable === 0n
        ? 4
        : 3
      : derived.ended
      ? 2
      : derived.running
      ? 1
      : 0;

  // Retained stake preview (exact integer math, mirrors the contract)
  const retainedPreview = (netWei * BigInt(myCompleted)) / BigInt(totalPeriods);

  return (
    <div className="shell py-10">
      <Link href="/explore" className="inline-flex items-center gap-1.5 text-sm text-dim hover:text-fg transition mb-8">
        <ArrowLeft className="w-4 h-4" /> All challenges
      </Link>

      {(iAmRemoved || iAmSuspended) && (
        <div className="mb-6 space-y-3">
          {iAmRemoved && <RemovedBanner reason={me?.disqualifyReason} />}
          {iAmSuspended && <SuspendedBanner rep={myReputation} />}
        </div>
      )}

      {/* ---------- HEADER ---------- */}
      <header className="space-y-5 pb-8 border-b border-line">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryTile category={challenge.category} size="sm" />
          <StatusBadge status={status} />
          <span className="chip">{challenge.category}</span>
          <span className="chip">
            {challenge.isPrivate ? <Lock className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
            {challenge.isPrivate ? "Private" : "Public"}
          </span>
          <span className="chip num">#{challenge.contractChallengeId}</span>
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-fg leading-[1.02] max-w-4xl">
          {challenge.name}
        </h1>
        {challenge.description && (
          <p className="text-dim text-base max-w-3xl leading-relaxed">{challenge.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-dim">
          <span className="flex items-center gap-2">
            <Avatar src={creator?.user?.avatar} seed={challenge.creatorAddress} size={24} />
            by <span className="text-fg">{displayName(creator?.user, challenge.creatorAddress)}</span>
            <button
              onClick={() => copy("creator", challenge.creatorAddress)}
              className="text-faint hover:text-fg"
              aria-label="Copy creator"
            >
              {copied === "creator" ? <Check className="w-3.5 h-3.5 text-ok" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </span>
          <span>
            {formatDate(challenge.startTime)} → {formatDate(challenge.endTime)}
          </span>
          <span>
            proof every {challenge.submissionFrequency || 1}d · {totalPeriods} periods
          </span>
        </div>

        {/* Key numbers */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line rounded-2xl overflow-hidden border border-line">
          {[
            [
              "Stake",
              formatEth(challenge.stakeAmountWei),
              "text-lime",
              "What each person puts in to join. You earn it back by showing up.",
            ],
            [
              "Pool",
              formatEth(netWei * BigInt(participantCount)),
              "text-fg",
              "Everyone's stakes together (after the joining fee). Missed periods feed the bonus for finishers.",
            ],
            ["People", null, "text-fg", "Who's in. At least 2 people are needed for the challenge to run."],
            [
              "Qualify at",
              `${challenge.qualificationThreshold}%`,
              "text-fg",
              `Prove at least ${challenge.qualificationThreshold}% of periods to share the bonus pool.`,
            ],
          ].map(([label, value, tone, tip]) => (
            <div key={label} className="bg-panel p-4 sm:p-5">
              <span className="eyebrow flex items-center gap-1.5">
                {label} <InfoTip>{tip}</InfoTip>
              </span>
              {value !== null ? (
                <p className={`num text-xl sm:text-2xl font-semibold mt-2 ${tone}`}>{value}</p>
              ) : (
                <div className="mt-2 flex items-center gap-2">
                  <AvatarStack people={peopleFromParticipants(participants)} max={4} size={26} />
                  <span className="num text-xl sm:text-2xl font-semibold text-fg">
                    {participantCount}
                    <span className="text-faint text-base">/{challenge.maxParticipants}</span>
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {!canRefund && status !== "CANCELLED" && <Journey stage={journeyStage} enrolled={isEnrolled} />}

        {canRefund && (
          <div className="flex gap-3 p-4 rounded-xl border border-warn/30 bg-warn/[0.06] text-sm">
            <AlertTriangle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
            <p className="text-dim">
              <span className="text-fg font-medium">Not enough people joined.</span> A challenge needs at least 2
              participants to run.{" "}
              {`Whoever joined can take back their stake minus the ${FEE_PERCENT_LABEL} joining fee.`} Connect the
              wallet that joined to claim it.
            </p>
          </div>
        )}

        {derived.running && !canRefund && (
          <div className="space-y-2">
            <div className="flex justify-between text-xs text-dim">
              <span>
                Period <span className="num text-fg">{derived.currentPeriod?.periodNumber || "–"}</span> of{" "}
                <span className="num">{totalPeriods}</span>
              </span>
              <span className="num">
                {formatTimeLeft(derived.currentPeriod?.endTime || challenge.endTime)} in this period
              </span>
            </div>
            <Progress value={derived.elapsedPct} />
          </div>
        )}
      </header>

      {/* ---------- BODY ---------- */}
      <div className="grid lg:grid-cols-[1fr_360px] gap-8 pt-8 items-start">
        <div className="min-w-0 space-y-6">
          <Segmented items={tabs} value={activeTab} onChange={setTab} />

          {activeTab === "overview" && (
            <div className="space-y-6 animate-fade-up">
              <section className="card p-6 space-y-5">
                <h2 className="text-xl font-semibold text-fg">How this challenge pays out</h2>
                <ol className="space-y-4">
                  {[
                    [
                      "Prove each period",
                      `Submit proof every ${challenge.submissionFrequency || 1} day${
                        (challenge.submissionFrequency || 1) === 1 ? "" : "s"
                      }. There are ${totalPeriods} periods in total.`,
                    ],
                    [
                      "Get verified by peers",
                      `A proof counts once ${requiredApprovals} other participant${
                        requiredApprovals === 1 ? "" : "s"
                      } approve it (33% of the cohort). You can't vote on your own proof.`,
                    ],
                    ...(feeWei > 0n
                      ? [
                          [
                            "Joining fee",
                            `${FEE_PERCENT_LABEL} of the stake (${formatEth(
                              feeWei
                            )}) goes to the protocol when you join and isn't refunded. Your challenge stake is ${formatEth(
                              netWei
                            )}.`,
                          ],
                        ]
                      : []),
                    [
                      "Keep what you earned",
                      `Each verified period keeps 1/${totalPeriods} of your stake. Missed periods go into a shared penalty pool.`,
                    ],
                    [
                      "Qualifiers split the pool",
                      `Finish at least ${challenge.qualificationThreshold}% and you share the penalty pool, weighted by periods completed. If nobody qualifies, the pool goes to the treasury.`,
                    ],
                    [
                      "Withdraw",
                      "After the end date anyone can trigger settlement. Then each participant withdraws their payout directly from the contract.",
                    ],
                  ].map(([title, body], i) => (
                    <li key={title} className="flex gap-4">
                      <span className="num w-7 h-7 shrink-0 rounded-full border border-line grid place-items-center text-xs text-dim">
                        {i + 1}
                      </span>
                      <div className="pt-0.5">
                        <p className="text-sm font-medium text-fg">{title}</p>
                        <p className="text-sm text-dim leading-relaxed mt-0.5">{body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="card p-6 grid sm:grid-cols-2 gap-6">
                <div>
                  <p className="eyebrow mb-3">Timeline</p>
                  <Row label="Joining closes">{formatDate(challenge.startTime)}</Row>
                  <Row label="Ends" className="border-t border-line">
                    {formatDate(challenge.endTime)}
                  </Row>
                </div>
                <div>
                  <p className="eyebrow mb-3">Custody</p>
                  <p className="text-sm text-dim leading-relaxed">
                    Stakes sit in the contract, not with us. Settlement is signed by the protocol attestor and verified
                    on-chain.
                  </p>
                  {EXPLORER && (
                    <a
                      href={`${EXPLORER}/address/${deployment.address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-sm link"
                    >
                      <span className="num">{shortenAddress(deployment.address)}</span>{" "}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </section>
            </div>
          )}

          {activeTab === "progress" && (
            <section className="card p-6 space-y-6 animate-fade-up">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 className="text-xl font-semibold text-fg">Periods</h2>
                {isEnrolled && (
                  <span className="text-sm text-dim">
                    You: <span className="num text-fg">{myCompleted}</span>/<span className="num">{totalPeriods}</span>{" "}
                    verified
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(challenge.periods || []).map((p) => {
                  const now = Date.now();
                  const isPast = now >= new Date(p.endTime).getTime();
                  const isCurrent = now >= new Date(p.startTime).getTime() && !isPast;
                  const mine = p.proofs?.find((pr) => pr.participantAddress.toLowerCase() === wallet);
                  return (
                    <div
                      key={p.id}
                      className={`rounded-xl border p-4 space-y-3 ${
                        isCurrent ? "border-lime/50 bg-lime/[0.04]" : "border-line bg-raised/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="num text-sm font-semibold text-fg">
                          P{String(p.periodNumber).padStart(2, "0")}
                        </span>
                        {isCurrent ? (
                          <Badge variant="lime">Now</Badge>
                        ) : isPast ? (
                          <Badge>Ended</Badge>
                        ) : (
                          <Badge>Upcoming</Badge>
                        )}
                      </div>
                      <p className="num text-xs text-faint">
                        {formatDate(p.startTime)} → {formatDate(p.endTime)}
                      </p>
                      {isEnrolled && (
                        <p className="text-xs">
                          {mine ? (
                            <span className="text-ok flex items-center gap-1">
                              <Check className="w-3.5 h-3.5" /> Proof submitted
                            </span>
                          ) : isPast ? (
                            <span className="text-bad">Missed</span>
                          ) : (
                            <span className="text-dim">Waiting for proof</span>
                          )}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {activeTab === "submit" && (
            <section className="card p-6 space-y-6 animate-fade-up">
              <div>
                <h2 className="text-xl font-semibold text-fg">Submit proof</h2>
                <p className="text-sm text-dim mt-1">
                  Share a link your peers can check. It counts once it gets enough approvals.
                </p>
              </div>
              {proofSent ? (
                <div className="rounded-xl border border-ok/25 bg-ok/5 p-6 text-center space-y-3">
                  <CheckCircle2 className="w-8 h-8 text-ok mx-auto" />
                  <p className="text-base font-semibold text-fg">Proof submitted</p>
                  <p className="text-sm text-dim">Your cohort will review it.</p>
                  <button onClick={() => setProofSent(false)} className="btn-secondary btn-sm">
                    Done
                  </button>
                </div>
              ) : openPeriods.length === 0 ? (
                <div className="well p-6 text-center space-y-1">
                  <p className="text-base font-medium text-fg">Nothing to submit right now</p>
                  <p className="text-sm text-dim">
                    {derived.beforeStart
                      ? `The first period opens ${formatDate(challenge.startTime)}.`
                      : derived.ended
                      ? "The challenge has ended."
                      : "You've already submitted proof for the current period. The next one opens soon."}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmitProof} className="space-y-4">
                  {openPeriods.length > 1 ? (
                    <div>
                      <label className="label">Period</label>
                      <select value={periodId} onChange={(e) => setPeriodId(e.target.value)} className="input num">
                        {openPeriods.map((p) => (
                          <option key={p.id} value={p.id}>
                            Period {p.periodNumber} · due {formatTimeLeft(p.endTime).replace(" left", "")}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <p className="text-sm text-dim">
                      For <span className="text-fg font-medium">period {openPeriods[0].periodNumber}</span> · due in{" "}
                      <span className="num text-fg">{formatTimeLeft(openPeriods[0].endTime).replace(" left", "")}</span>
                    </p>
                  )}
                  <div>
                    <label className="label">Link to proof</label>
                    <input
                      type="url"
                      required
                      placeholder="https://… (photo, doc, commit, activity — any link)"
                      value={proofUri}
                      onChange={(e) => setProofUri(e.target.value)}
                      className="input num"
                    />
                  </div>
                  <div>
                    <label className="label">Note (optional)</label>
                    <textarea
                      rows={3}
                      placeholder="What did you do this period?"
                      value={proofNote}
                      onChange={(e) => setProofNote(e.target.value)}
                      className="input"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submittingProof || iAmSuspended || iAmRemoved}
                    className="btn-primary w-full sm:w-auto"
                  >
                    {submittingProof ? <Spinner /> : <Send className="w-4 h-4" />}
                    Submit proof
                  </button>
                </form>
              )}
            </section>
          )}

          {activeTab === "review" && (
            <section className="space-y-4 animate-fade-up">
              <p className="text-sm text-dim">
                Each proof needs <span className="num text-fg">{requiredApprovals}</span> approval
                {requiredApprovals === 1 ? "" : "s"} to count.
              </p>
              {peerProofs.length === 0 ? (
                <EmptyState
                  icon={ShieldCheck}
                  title="Nothing to review"
                  body="When other participants submit proof, it shows up here."
                />
              ) : (
                peerProofs.map((proof) => (
                  <ProofCard
                    key={proof.id}
                    proof={proof}
                    wallet={wallet}
                    requiredApprovals={requiredApprovals}
                    voting={votingId === proof.id}
                    canVote={canAct}
                    onVote={handleVote}
                    canReport={isEnrolled}
                    onReport={(t) => setReportTarget({ ...t, contractChallengeId: challenge.contractChallengeId })}
                  />
                ))
              )}
              {myProofs.length > 0 && (
                <div className="space-y-3 pt-4">
                  <h3 className="text-sm font-medium text-dim">Votes on your proofs</h3>
                  {myProofs.map((proof) => (
                    <ProofCard
                      key={proof.id}
                      proof={proof}
                      wallet={wallet}
                      requiredApprovals={requiredApprovals}
                      canVote={false}
                      canReport={isEnrolled}
                      onReport={(t) => setReportTarget({ ...t, contractChallengeId: challenge.contractChallengeId })}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === "people" && (
            <section className="card divide-y divide-line animate-fade-up">
              {participants.length === 0 ? (
                <p className="p-6 text-sm text-dim">No one has joined yet.</p>
              ) : (
                participants.map((p) => {
                  const done = p.completedPeriods || 0;
                  const pct = Math.round((done / totalPeriods) * 100);
                  const qualified = pct >= Number(challenge.qualificationThreshold);
                  const isMe = p.walletAddress.toLowerCase() === wallet;
                  return (
                    <div key={p.id} className="p-4 sm:px-6 flex items-center gap-4">
                      <Avatar src={p.user?.avatar} seed={p.walletAddress} size={40} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-fg truncate flex items-center gap-2">
                          <span className="truncate">{displayName(p.user, p.walletAddress)}</span>
                          {isMe && <span className="text-faint font-normal">· you</span>}
                          <ReputationBadge rep={reps[p.walletAddress.toLowerCase()]} compact />
                          {p.disqualifiedAt && (
                            <span className="chip h-5 text-bad border-bad/25 bg-bad/10">removed</span>
                          )}
                        </p>
                        <p className="num text-xs text-faint flex items-center gap-3">
                          {shortenAddress(p.walletAddress)}
                          {isEnrolled && !isMe && (
                            <button
                              onClick={() =>
                                setReportTarget({
                                  wallet: p.walletAddress,
                                  name: displayName(p.user, p.walletAddress),
                                  contractChallengeId: challenge.contractChallengeId,
                                })
                              }
                              className="font-sans text-faint hover:text-bad transition"
                            >
                              Report
                            </button>
                          )}
                        </p>
                      </div>
                      <div className="w-32 sm:w-48 space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="num text-dim">
                            {done}/{totalPeriods}
                          </span>
                          {qualified && <span className="text-ok">qualifies</span>}
                        </div>
                        <Progress value={pct} tone={qualified ? "ok" : "lime"} />
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          )}

          {activeTab === "invites" && challenge.isPrivate && isCreator && (
            <section className="space-y-4 animate-fade-up">
              {!inviteUrl && (
                <div className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-sm text-dim">Confirm it's you to reveal the private invite link.</p>
                  <button
                    onClick={async () => (await authenticateWithWallet()) && fetchChallenge()}
                    className="btn-secondary btn-sm shrink-0"
                  >
                    Show invite link
                  </button>
                </div>
              )}
              {inviteUrl && (
                <div className="card p-5 space-y-3">
                  <p className="text-sm font-medium text-fg">Share link</p>
                  <div className="flex gap-2">
                    <input readOnly value={inviteUrl} className="input num text-xs" />
                    <button onClick={() => copy("invite", inviteUrl)} className="btn-secondary shrink-0">
                      {copied === "invite" ? <Check className="w-4 h-4 text-ok" /> : <Copy className="w-4 h-4" />}
                      {copied === "invite" ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              )}
              {derived.beforeStart && (
                <form onSubmit={handleAddInvite} className="card p-5 space-y-3">
                  <p className="text-sm font-medium text-fg">Invite a wallet</p>
                  <div className="flex gap-2">
                    <input
                      placeholder="0x…"
                      value={inviteWallet}
                      onChange={(e) => setInviteWallet(e.target.value)}
                      className="input num"
                    />
                    <button type="submit" disabled={inviting || !inviteWallet} className="btn-primary shrink-0">
                      {inviting ? <Spinner /> : <UserPlus className="w-4 h-4" />} Invite
                    </button>
                  </div>
                </form>
              )}
              {!derived.beforeStart && (
                <p className="text-sm text-dim">
                  The challenge has started, so invitations are final — no new invites or revokes.
                </p>
              )}
              <div className="card divide-y divide-line">
                {(challenge.invitations || []).map((inv) => (
                  <div key={inv.id} className="px-5 py-3.5 flex items-center justify-between gap-3 text-sm">
                    <span className="num text-fg truncate">
                      {inv.walletAddress ? shortenAddress(inv.walletAddress) : "Share link"}
                    </span>
                    <div className="flex items-center gap-3">
                      <Badge variant={inv.status === "ACCEPTED" ? "ok" : inv.status === "REVOKED" ? "bad" : "warn"}>
                        {inv.status.toLowerCase()}
                      </Badge>
                      {inv.status !== "REVOKED" && derived.beforeStart && (
                        <button
                          onClick={() => handleRevokeInvite(inv.id, inv.walletAddress)}
                          className="text-xs text-bad hover:underline"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <ReportDialog target={reportTarget} reporter={wallet} onClose={() => setReportTarget(null)} />

        {/* ---------- POSITION PANEL ---------- */}
        <aside className="lg:sticky lg:top-24 space-y-4">
          <div className="card-glow p-6 space-y-5">
            <div className="flex items-center justify-between">
              <p className="eyebrow">Your position</p>
              {wallet && (
                <button
                  onClick={refreshPosition}
                  className="text-faint hover:text-fg transition"
                  aria-label="Refresh on-chain balance"
                  title="Refresh from chain"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${positionLoading ? "animate-spin" : ""}`} />
                </button>
              )}
            </div>

            {!wallet ? (
              <>
                <p className="text-sm text-dim">Connect a wallet to join, track progress and withdraw.</p>
                <button onClick={connectWallet} className="btn-primary w-full">
                  Connect wallet
                </button>
              </>
            ) : (
              <>
                {/* Claimable payout — the headline whenever there's money waiting */}
                {claimable > 0n ? (
                  <div className="rounded-xl bg-lime text-ink p-5 space-y-4">
                    <div>
                      <p className="text-xs font-medium opacity-70">
                        {status === "CANCELLED" ? "Refund ready" : "Payout ready to withdraw"}
                      </p>
                      <p className="num text-3xl font-bold mt-1">{formatEth(claimable)}</p>
                    </div>
                    <button onClick={handleWithdraw} className="btn w-full bg-ink text-lime hover:bg-black">
                      <Coins className="w-4 h-4" /> Withdraw to wallet
                    </button>
                  </div>
                ) : position?.hasWithdrawn ? (
                  <div className="rounded-xl border border-ok/25 bg-ok/5 p-4 flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-ok shrink-0" />
                    <p className="text-sm text-fg">
                      {status === "CANCELLED" ? "Refund sent to your wallet." : "Payout withdrawn to your wallet."}
                    </p>
                  </div>
                ) : null}

                {isEnrolled && (
                  <div className="space-y-3">
                    <div className="flex items-end justify-between">
                      <span className="text-sm text-dim">Verified periods</span>
                      <span className="num text-sm text-fg">
                        {myCompleted}/{totalPeriods}
                      </span>
                    </div>
                    <Progress value={myPct} tone={myPct >= challenge.qualificationThreshold ? "ok" : "lime"} />
                    <div className="divide-y divide-line">
                      <Row label="Staked">
                        <span className="num">{formatEth(challenge.stakeAmountWei)}</span>
                      </Row>
                      {feeWei > 0n && (
                        <Row label={`Joining fee (${FEE_PERCENT_LABEL})`}>
                          <span className="num text-dim">−{formatEth(feeWei)}</span>
                        </Row>
                      )}
                      {status !== "CANCELLED" && (
                        <Row label="Kept so far">
                          <span className="num">{formatEth(retainedPreview)}</span>
                        </Row>
                      )}
                      <Row label="Qualifies for pool">
                        {myPct >= challenge.qualificationThreshold ? (
                          <span className="text-ok">Yes</span>
                        ) : (
                          <span className="text-dim">Needs {challenge.qualificationThreshold}%</span>
                        )}
                      </Row>
                    </div>
                  </div>
                )}

                {/* Primary lifecycle action */}
                {canJoin &&
                  (authorizedForPrivate ? (
                    <div className="space-y-2">
                      <button onClick={handleJoin} disabled={iAmSuspended} className="btn-primary btn-lg w-full">
                        Stake {formatEth(challenge.stakeAmountWei)} & join
                      </button>
                      {iAmSuspended && (
                        <p className="text-xs text-bad text-center">Suspended accounts can&apos;t join challenges.</p>
                      )}
                      {feeWei > 0n && (
                        <p className="text-xs text-faint text-center">
                          Includes a {FEE_PERCENT_LABEL} joining fee ({formatEth(feeWei)}). Your challenge stake:{" "}
                          {formatEth(netWei)}.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="well p-4 text-sm text-dim">
                      This challenge is invite-only. Ask the creator for an invite link.
                    </div>
                  ))}

                {!canJoin && !isEnrolled && status === "OPEN" && derived.beforeStart && isFull && (
                  <p className="text-sm text-dim">This challenge is full.</p>
                )}
                {!isEnrolled && !derived.beforeStart && !isClosed && !canRefund && (
                  <p className="text-sm text-dim">Joining closed when the challenge started.</p>
                )}

                {canSettle && (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-start gap-2.5 text-sm text-dim">
                      <Gavel className="w-4 h-4 mt-0.5 text-violet shrink-0" />
                      <span>The challenge has ended. Settle it on-chain to unlock everyone's payouts.</span>
                    </div>
                    <button onClick={handleSettle} className="btn-primary w-full">
                      Settle & unlock payouts
                    </button>
                  </div>
                )}

                {canRefund && isEnrolled && !position?.hasWithdrawn && claimable === 0n && (
                  <div className="space-y-3 pt-1">
                    <div className="flex items-start gap-2.5 text-sm text-dim">
                      <AlertTriangle className="w-4 h-4 mt-0.5 text-warn shrink-0" />
                      <span>
                        Fewer than 2 people joined, so this challenge can&apos;t run.{" "}
                        {`Take back your stake minus the ${FEE_PERCENT_LABEL} joining fee.`}
                      </span>
                    </div>
                    <button onClick={handleRefund} className="btn-primary w-full">
                      <Coins className="w-4 h-4" /> Get {formatEth(netWei)} back
                    </button>
                  </div>
                )}

                {status === "FINALIZED" && isEnrolled && claimable === 0n && !position?.hasWithdrawn && position && (
                  <p className="text-sm text-dim">
                    Settled. Nothing is claimable for this wallet — you completed no verified periods and didn't
                    qualify.
                  </p>
                )}

                {isEnrolled && derived.running && (
                  <button onClick={() => setTab("submit")} className="btn-secondary w-full">
                    <Upload className="w-4 h-4" /> Submit this period's proof
                  </button>
                )}

                {derived.beforeStart && <Countdown to={challenge.startTime} label="Starts in" />}
                {derived.running && derived.currentPeriod && (
                  <Countdown to={derived.currentPeriod.endTime} label="This period closes in" />
                )}
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ProofCard({ proof, wallet, requiredApprovals, voting, canVote, onVote, canReport, onReport }) {
  const votes = proof.verifications || [];
  const live = votes.filter((v) => !v.voided);
  const approvals = live.filter((v) => v.decision === "APPROVE").length;
  const rejections = live.filter((v) => v.decision === "REJECT").length;
  const hasVoted = wallet && votes.some((v) => v.verifierAddress.toLowerCase() === wallet);
  const met = approvals >= requiredApprovals && approvals > rejections;

  return (
    <div className="card p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Avatar src={proof.user?.avatar} seed={proof.participantAddress} size={28} />
            <span className="text-sm font-medium text-fg">{displayName(proof.user, proof.participantAddress)}</span>
            <span className="chip num">P{proof.periodNumber}</span>
            {met && <Badge variant="ok">Verified</Badge>}
            {hasVoted && <Badge variant="violet">You voted</Badge>}
          </div>
          {proof.note && <p className="text-sm text-dim leading-relaxed">{proof.note}</p>}
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <a href={proof.contentUri} target="_blank" rel="noreferrer" className="link inline-flex items-center gap-1">
              Open proof <ExternalLink className="w-3 h-3" />
            </a>
            <span className="text-dim num">
              <span className="text-ok">{approvals}</span> / {requiredApprovals} approvals
              {rejections > 0 && <span className="text-bad"> · {rejections} reject</span>}
            </span>
          </div>
        </div>
        {canVote && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => onVote(proof.id, "REJECT")}
              disabled={voting || hasVoted}
              className="btn-danger btn-sm"
            >
              Reject
            </button>
            <button
              onClick={() => onVote(proof.id, "APPROVE")}
              disabled={voting || hasVoted}
              className="btn-primary btn-sm"
            >
              {voting ? <Spinner className="w-3.5 h-3.5" /> : null} Approve
            </button>
          </div>
        )}
      </div>

      {votes.length > 0 && (
        <ul className="flex flex-wrap gap-2 pt-3 border-t border-line">
          {votes.map((v) => {
            const mine = v.verifierAddress.toLowerCase() === wallet;
            const name = displayName(v.user, v.verifierAddress);
            return (
              <li
                key={v.id}
                className={`flex items-center gap-2 h-8 pl-1 pr-2 rounded-full border text-xs ${
                  v.voided
                    ? "border-line text-faint line-through"
                    : v.decision === "APPROVE"
                    ? "border-ok/25 bg-ok/5"
                    : "border-bad/25 bg-bad/5"
                }`}
                title={v.voided ? "Cancelled by the admin after a complaint" : undefined}
              >
                <Avatar src={v.user?.avatar} seed={v.verifierAddress} size={22} />
                <span className="text-fg max-w-[8rem] truncate">{mine ? "You" : name}</span>
                <span className={v.voided ? "" : v.decision === "APPROVE" ? "text-ok" : "text-bad"}>
                  {v.decision === "APPROVE" ? "approved" : "rejected"}
                </span>
                {canReport && !mine && !v.voided && (
                  <button
                    onClick={() =>
                      onReport({ verificationId: v.id, wallet: v.verifierAddress, name, decision: v.decision })
                    }
                    className="text-faint hover:text-bad transition no-underline"
                    aria-label={`Report ${name}'s vote`}
                    title="Report this vote"
                  >
                    <Flag className="w-3.5 h-3.5" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

const JOURNEY = [
  ["Join", "Stake before it starts"],
  ["Prove", "Post proof each period & review others"],
  ["Settle", "Lock in everyone's results"],
  ["Withdraw", "Collect your payout"],
];

/** "You are here" strip so people always know the next step. */
function Journey({ stage, enrolled }) {
  return (
    <ol className="grid grid-cols-4 gap-2" aria-label="Challenge progress">
      {JOURNEY.map(([title, hint], i) => {
        const done = i < stage;
        const current = i === stage;
        return (
          <li key={title} className="space-y-2">
            <div className={`h-1.5 rounded-full overflow-hidden ${done ? "bg-lime" : "bg-raised"}`}>
              {current && <div className="h-full w-1/2 bg-lime/70 rounded-full animate-pulse" />}
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className={`w-4 h-4 shrink-0 rounded-full grid place-items-center text-[9px] font-bold ${
                  done ? "bg-lime text-ink" : current ? "bg-fg text-ink" : "bg-raised text-faint"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={`text-xs font-medium ${current ? "text-fg" : done ? "text-dim" : "text-faint"}`}>
                {title}
              </span>
              {current && enrolled && <span className="hidden sm:inline text-[10px] text-lime">· you are here</span>}
            </div>
            <p className="hidden sm:block text-[11px] text-faint leading-snug">{hint}</p>
          </li>
        );
      })}
    </ol>
  );
}
