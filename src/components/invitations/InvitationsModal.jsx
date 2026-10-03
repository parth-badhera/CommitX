"use client";

import React from "react";
import Link from "next/link";
import { useInvitations } from "@/context/InvitationsContext";
import { formatEth, shortenAddress, formatTimeLeft } from "@/lib/formatters";
import { X, Mail, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export function InvitationsModal() {
  const { invitations, pendingCount, isModalOpen, setIsModalOpen, declineInvitation } = useInvitations();

  if (!isModalOpen) return null;
  const close = () => setIsModalOpen(false);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={close}>
      <div
        className="card w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5 border-b border-line flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-fg">Invitations</h3>
            <p className="text-sm text-dim mt-0.5">
              {pendingCount > 0
                ? `${pendingCount} private ${pendingCount === 1 ? "challenge is" : "challenges are"} waiting for you.`
                : "Private challenges your wallet was invited to."}
            </p>
          </div>
          <button onClick={close} className="w-9 h-9 rounded-full grid place-items-center text-dim hover:text-fg hover:bg-raised" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 overflow-y-auto space-y-3">
          {invitations.length === 0 ? (
            <div className="py-14 text-center space-y-3">
              <Mail className="w-8 h-8 text-faint mx-auto" />
              <p className="text-sm font-medium text-fg">No invitations yet</p>
              <p className="text-sm text-dim max-w-xs mx-auto">
                When someone invites your wallet to a private challenge, it shows up here.
              </p>
            </div>
          ) : (
            invitations.map((inv) => {
              const c = inv.challenge;
              const isPending = inv.status === "PENDING" && !inv.isEnrolled && !inv.isExpired;
              const isAccepted = inv.status === "ACCEPTED" || inv.isEnrolled;
              const isExpired = inv.isExpired;

              return (
                <div key={inv.id} className="well p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs text-faint">
                        #{c.contractChallengeId} · from <span className="num">{shortenAddress(inv.invitedBy)}</span>
                      </p>
                      <h4 className="text-base font-semibold text-fg truncate">{c.name}</h4>
                    </div>
                    {isAccepted ? (
                      <Badge variant="ok">Joined</Badge>
                    ) : isExpired ? (
                      <Badge variant="bad">Expired</Badge>
                    ) : (
                      <Badge variant="warn">Needs response</Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="block text-faint mb-0.5">Stake</span>
                      <span className="num text-fg font-semibold">{formatEth(c.stakeAmountWei)}</span>
                    </div>
                    <div>
                      <span className="block text-faint mb-0.5">Cadence</span>
                      <span className="num text-fg">every {c.submissionFrequency || 1}d</span>
                    </div>
                    <div>
                      <span className="block text-faint mb-0.5">Starts</span>
                      <span className="num text-fg">{formatTimeLeft(c.startTime).replace(" left", "")}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    {isPending && (
                      <button onClick={() => declineInvitation(inv.id)} className="btn-ghost btn-sm">
                        Decline
                      </button>
                    )}
                    <Link
                      href={
                        isAccepted
                          ? `/challenges/${c.contractChallengeId}`
                          : `/challenges/${c.contractChallengeId}?invite=${inv.inviteToken}`
                      }
                      onClick={close}
                      className={`${isPending ? "btn-primary" : "btn-secondary"} btn-sm`}
                    >
                      {isAccepted ? "Open" : isExpired ? "View" : "Review & join"}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
