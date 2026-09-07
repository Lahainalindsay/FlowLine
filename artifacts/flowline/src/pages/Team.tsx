import React, { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetDashboardSummaryQueryKey,
  getListEventsQueryKey,
  getListInvitationsQueryKey,
  getListTeamMembersQueryKey,
  useAcceptInvitation,
  useCreateInvitation,
  useGetWorkspaceSummary,
  useListInvitations,
  useListTeamMembers,
  useRevokeInvitation,
  useUpdateTeamMemberRole,
} from "@workspace/api-client-react";
import { StageTimeLayout, StageTimeCard, StageTimeButton, StageTimeInput, StageTimeLabel, StageTimeSelect } from "../components/stagetime";
import { Users, Mail, Loader2, Copy, Shield, XCircle, CheckCircle2 } from "lucide-react";

export default function Team() {
  const queryClient = useQueryClient();
  const { data: workspace } = useGetWorkspaceSummary();
  const members = useListTeamMembers();
  const invitations = useListInvitations();
  const invite = useCreateInvitation();
  const accept = useAcceptInvitation();
  const updateRole = useUpdateTeamMemberRole();
  const revoke = useRevokeInvitation({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListInvitationsQueryKey() }) } });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("OPERATOR");
  const [inviteLink, setInviteLink] = useState("");
  const [feedback, setFeedback] = useState("");
  const attemptedInviteToken = useRef("");
  const canManage = workspace ? ["OWNER", "ADMIN"].includes(workspace.role) : false;

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("invite");
    if (!token || attemptedInviteToken.current === token) return;
    attemptedInviteToken.current = token;
    accept.mutate(
      { data: { token } },
      {
        onSuccess: () => {
          setFeedback("Invitation accepted. Shared events are now available on your dashboard.");
          window.history.replaceState({}, "", `${import.meta.env.BASE_URL.replace(/\/$/, "")}/team`);
          queryClient.invalidateQueries({ queryKey: getListTeamMembersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getListEventsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        },
        onError: () => setFeedback("This invitation is invalid, expired, revoked, or belongs to another email address."),
      },
    );
  }, [accept, queryClient]);

  return (
    <StageTimeLayout>
      <div className="max-w-5xl mx-auto fade-up h-full flex flex-col">
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-stagetime-blue)]/10 border border-[var(--color-stagetime-blue)]/20 text-[var(--color-stagetime-cyan)] text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
            Workspace Access
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white display-font mb-4">Team</h1>
          <p className="text-[var(--color-stagetime-text-dim)] text-lg">People with access to this workspace and its productions.</p>
        </div>

        {feedback && (
          <div className={`mb-8 p-4 rounded-xl border flex items-start gap-3 ${feedback.startsWith("Invitation accepted") ? "bg-[var(--color-stagetime-green)]/10 border-[var(--color-stagetime-green)]/30 text-[var(--color-stagetime-green)]" : "bg-[var(--color-stagetime-red)]/10 border-[var(--color-stagetime-red)]/30 text-[var(--color-stagetime-red)]"}`}>
            {feedback.startsWith("Invitation accepted") ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <XCircle className="h-5 w-5 shrink-0" />}
            <p role="status" className="font-medium text-sm">{feedback}</p>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <StageTimeCard className="p-8">
              <div className="flex items-center gap-3 mb-6 border-b border-[var(--color-stagetime-border)] pb-4">
                <Users className="h-5 w-5 text-[var(--color-stagetime-cyan)]" />
                <h2 className="font-bold text-white text-xl display-font">Active Members</h2>
              </div>
              
              {members.isLoading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[var(--color-stagetime-blue)]" /></div>
              ) : members.isError ? (
                <p className="text-[var(--color-stagetime-red)] p-4 bg-[var(--color-stagetime-red)]/10 rounded-lg">Members could not be loaded.</p>
              ) : (
                <div className="space-y-4">
                  {members.data?.map((member) => (
                    <div key={member.id} className="flex items-center justify-between gap-4 p-4 rounded-xl bg-[rgba(0,0,0,0.2)] border border-[var(--color-stagetime-border)]">
                      <div className="min-w-0 flex-1 flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-[var(--color-stagetime-blue)]/20 border border-[var(--color-stagetime-blue)]/30 flex items-center justify-center font-bold text-[var(--color-stagetime-cyan)]">
                          {(member.displayName || member.email || member.userId)[0].toUpperCase()}
                        </div>
                        <div className="truncate">
                          <div className="font-bold text-white text-sm">{member.displayName || member.email || member.userId}</div>
                          {member.displayName && <div className="text-xs text-[var(--color-stagetime-text-dim)]">{member.email}</div>}
                        </div>
                      </div>
                      
                      {member.role === "OWNER" || !canManage ? (
                        <div className="px-3 py-1 bg-[var(--color-stagetime-panel)] rounded border border-[var(--color-stagetime-border)] text-xs font-bold text-[var(--color-stagetime-text-dim)] uppercase tracking-widest">
                          {member.role}
                        </div>
                      ) : (
                        <StageTimeSelect 
                          aria-label={`Role for ${member.displayName || member.email || "team member"}`} 
                          className="w-40 py-2 h-auto text-xs" 
                          value={member.role} 
                          disabled={updateRole.isPending} 
                          onChange={(e) => {
                            setFeedback("");
                            updateRole.mutate(
                              { memberId: member.id, data: { role: e.target.value as "ADMIN" | "OPERATOR" | "VIEWER" } },
                              {
                                onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTeamMembersQueryKey() }),
                                onError: () => setFeedback("Could not update the team member role."),
                              },
                            );
                          }}
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="OPERATOR">Operator</option>
                          <option value="VIEWER">Viewer</option>
                        </StageTimeSelect>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </StageTimeCard>

            <StageTimeCard className="p-8">
              <div className="flex items-center gap-3 mb-6 border-b border-[var(--color-stagetime-border)] pb-4">
                <Mail className="h-5 w-5 text-[var(--color-stagetime-text-dim)]" />
                <h2 className="font-bold text-white text-xl display-font">Pending Invitations</h2>
              </div>

              {invitations.isLoading ? (
                <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-stagetime-blue)]" /></div>
              ) : invitations.isError ? (
                <p className="text-[var(--color-stagetime-red)] p-4 bg-[var(--color-stagetime-red)]/10 rounded-lg">Invitations could not be loaded.</p>
              ) : invitations.data?.length === 0 ? (
                <div className="text-center py-10 text-sm text-[var(--color-stagetime-text-dim)] border border-[var(--color-stagetime-border)] border-dashed rounded-xl bg-black/10">No pending invitations.</div>
              ) : (
                <div className="space-y-3">
                  {invitations.data?.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 rounded-lg bg-[rgba(0,0,0,0.2)] border border-[var(--color-stagetime-border)]">
                      <div>
                        <div className="text-sm font-bold text-white">{item.email}</div>
                        <div className="text-xs text-[var(--color-stagetime-text-dim)] mt-0.5 uppercase tracking-widest">{item.role}</div>
                      </div>
                      <StageTimeButton 
                        size="sm" 
                        variant={item.revokedAt ? "ghost" : "outline"} 
                        disabled={!canManage || !!item.revokedAt} 
                        onClick={() => revoke.mutate({ invitationId: item.id })}
                      >
                        {item.revokedAt ? "Revoked" : "Revoke"}
                      </StageTimeButton>
                    </div>
                  ))}
                </div>
              )}
            </StageTimeCard>
          </div>

          <div className="lg:col-span-1">
            <StageTimeCard className="p-6 sticky top-24 border-[var(--color-stagetime-blue)]/20 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
              <div className="flex items-center gap-2 mb-6">
                <Shield className="h-5 w-5 text-[var(--color-stagetime-cyan)]" />
                <h2 className="font-bold text-white text-lg display-font">Invite Member</h2>
              </div>
              
              <form className="flex flex-col gap-5" onSubmit={(e) => {
                e.preventDefault();
                if (!canManage || !email) return;
                setFeedback("");
                invite.mutate(
                  { data: { email, role: role as "ADMIN" | "OPERATOR" | "VIEWER" } },
                  {
                    onSuccess: (created) => {
                      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
                      setInviteLink(`${window.location.origin}${base}/team?invite=${encodeURIComponent(created.token)}`);
                      setEmail("");
                      queryClient.invalidateQueries({ queryKey: getListInvitationsQueryKey() });
                    },
                    onError: () => setFeedback("Could not create the invitation. Check the address and try again."),
                  },
                );
              }}>
                <div>
                  <StageTimeLabel>Email Address</StageTimeLabel>
                  <StageTimeInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="crew@example.com" disabled={!canManage} />
                </div>
                <div>
                  <StageTimeLabel>Role</StageTimeLabel>
                  <StageTimeSelect value={role} onChange={(e) => setRole(e.target.value)} disabled={!canManage}>
                    <option value="OPERATOR">Operator</option>
                    <option value="VIEWER">Viewer</option>
                    <option value="ADMIN">Admin</option>
                  </StageTimeSelect>
                </div>
                
                <StageTimeButton className="w-full mt-2" variant="primary" disabled={!canManage || !email || invite.isPending} loading={invite.isPending}>
                  Send Invite
                </StageTimeButton>
                
                {!canManage && <p className="text-xs text-[var(--color-stagetime-orange)] mt-2 text-center">Only workspace owners and admins can invite team members.</p>}
              </form>

              {inviteLink && (
                <div className="mt-8 pt-6 border-t border-[var(--color-stagetime-border)]">
                  <StageTimeLabel>One-time link</StageTimeLabel>
                  <div className="flex gap-2">
                    <StageTimeInput readOnly value={inviteLink} className="font-mono text-xs flex-1" />
                    <StageTimeButton type="button" variant="outline" onClick={() => navigator.clipboard.writeText(inviteLink)} className="px-3 shrink-0">
                      <Copy className="h-4 w-4" />
                    </StageTimeButton>
                  </div>
                  <p className="mt-3 text-[10px] text-[var(--color-stagetime-text-dim)] uppercase tracking-wider text-center">
                    Send this link securely. It expires automatically and can only be accepted once.
                  </p>
                </div>
              )}
            </StageTimeCard>
          </div>
        </div>
      </div>
    </StageTimeLayout>
  );
}