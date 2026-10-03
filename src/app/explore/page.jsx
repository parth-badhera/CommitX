"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Globe, Plus, Mail } from "lucide-react";
import { useInvitations } from "@/context/InvitationsContext";
import { PageHeader, Segmented, EmptyState, ChallengeCard } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/Badge";

const CATEGORIES = ["All", "Coding", "Running", "Studying", "Fitness", "Reading", "Meditation", "Walking", "Custom"];

export default function ExplorePage() {
  const { invitations, pendingCount, setIsModalOpen } = useInvitations();
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");

  // Debounce search so we don't hit the API (and the chain sync) on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const statuses = [
    { id: "All", label: "All" },
    { id: "OPEN", label: "Open to join" },
    { id: "ACTIVE", label: "In progress" },
    { id: "FINALIZED", label: "Settled" },
    ...(invitations.length > 0 ? [{ id: "Invited", label: `Invited · ${invitations.length}` }] : []),
  ];

  useEffect(() => {
    if (statusFilter === "Invited") {
      let list = invitations.map((inv) => ({
        ...inv.challenge,
        isInvitedCard: true,
        inviteToken: inv.inviteToken,
        isEnrolled: inv.isEnrolled,
      }));
      if (category !== "All") list = list.filter((c) => c.category === category);
      if (query) {
        const q = query.toLowerCase();
        list = list.filter((c) => c.name.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q));
      }
      setChallenges(list);
      setLoading(false);
      return;
    }

    setLoading(true);
    const params = new URLSearchParams({ visibility: "Public" });
    if (category !== "All") params.append("category", category);
    if (statusFilter !== "All") params.append("status", statusFilter);
    if (query) params.append("search", query);

    let cancelled = false;
    fetch(`/api/challenges?${params}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setChallenges(d.challenges || []))
      .catch((err) => console.error("Error fetching challenges:", err))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [category, statusFilter, query, invitations]);

  const filtered = search || category !== "All" || statusFilter !== "All";

  return (
    <div className="shell py-12 space-y-8">
      <PageHeader
        eyebrow="Explore"
        title="Find something worth committing to"
        subtitle="Public challenges accepting stakes. Join before the start date, prove each period, and get paid for showing up."
        actions={
          <Link href="/create" className="btn-primary">
            <Plus className="w-4 h-4" /> New challenge
          </Link>
        }
      />

      {pendingCount > 0 && (
        <button
          onClick={() => setIsModalOpen(true)}
          className="card-hover w-full p-4 flex items-center gap-3 text-left border-violet/30"
        >
          <Mail className="w-5 h-5 text-violet shrink-0" />
          <span className="text-sm text-fg flex-1">
            You have {pendingCount} private {pendingCount === 1 ? "invitation" : "invitations"} waiting.
          </span>
          <span className="text-sm text-violet">Review</span>
        </button>
      )}

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-faint absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search challenges"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-11 rounded-full"
          />
        </div>
        <Segmented items={statuses} value={statusFilter} onChange={setStatusFilter} />
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`h-8 px-3.5 rounded-full text-xs font-medium border whitespace-nowrap transition ${
              category === c ? "border-lime/50 text-lime bg-lime/10" : "border-line text-dim hover:text-fg hover:border-line-strong"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card h-72 animate-pulse" />
          ))}
        </div>
      ) : challenges.length === 0 ? (
        <EmptyState
          icon={Globe}
          title={filtered ? "No matches" : "No public challenges yet"}
          body={filtered ? "Try a different search or clear the filters." : "Start the first one and invite people to join you."}
          action={
            <Link href="/create" className="btn-primary">
              Start a challenge
            </Link>
          }
        />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {challenges.map((c) => (
            <ChallengeCard
              key={c.id}
              challenge={c}
              href={
                c.isInvitedCard && !c.isEnrolled
                  ? `/challenges/${c.contractChallengeId}?invite=${c.inviteToken}`
                  : `/challenges/${c.contractChallengeId}`
              }
              badge={c.isInvitedCard ? <Badge variant="violet">Invited</Badge> : null}
              cta={c.isInvitedCard && !c.isEnrolled ? "Review" : "View"}
            />
          ))}
        </div>
      )}
    </div>
  );
}
