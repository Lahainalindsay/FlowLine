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
import { Shell } from "../components/layout";
import { Button, Card, Input, Label, Select } from "../components/ui";

export default function Team() {
  const queryClient = useQueryClient(); const { data: workspace } = useGetWorkspaceSummary();
  const members = useListTeamMembers(); const invitations = useListInvitations();
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

  return <Shell><div className="max-w-4xl mx-auto space-y-6 fade-up">
    <div><h1 className="text-3xl font-bold text-white">Team</h1><p className="text-slate-400 mt-1">People with access to this workspace.</p></div>
    {feedback && <Card className="p-4"><p role="status" className={feedback.startsWith("Invitation accepted") ? "text-sm text-emerald-400" : "text-sm text-red-400"}>{feedback}</p></Card>}
    <Card className="p-6"><form className="flex gap-3" onSubmit={(e) => {
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
      <div className="flex-1"><Label>Invite by email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="crew@example.com" disabled={!canManage} /></div>
      <div className="w-36"><Label>Role</Label><Select value={role} onChange={(e) => setRole(e.target.value)} disabled={!canManage}><option value="OPERATOR">Operator</option><option value="VIEWER">Viewer</option><option value="ADMIN">Admin</option></Select></div>
      <Button className="self-end" variant="primary" disabled={!canManage || !email || invite.isPending}>Send invite</Button>
    </form>
      {!canManage && <p className="text-xs text-amber-300 mt-3">Only workspace owners and admins can invite team members.</p>}
      {inviteLink && <div className="mt-4"><Label>One-time invitation link</Label><div className="flex gap-2"><Input readOnly value={inviteLink} className="font-mono text-xs" /><Button type="button" variant="outline" onClick={() => navigator.clipboard.writeText(inviteLink)}>Copy</Button></div><p className="mt-2 text-xs text-slate-500">Send this link securely to the invited email address. It expires automatically and can only be accepted once.</p></div>}
    </Card>
    <Card className="p-6"><h2 className="font-bold text-white mb-4">Members</h2>
      {members.isLoading ? <p className="text-slate-400">Loading members…</p> : members.isError ? <p className="text-slate-400">Members could not be loaded.</p> : members.data?.map((member) => <div key={member.id} className="flex items-center justify-between gap-4 py-3 border-b border-white/5"><span className="min-w-0 truncate text-slate-200">{member.displayName || member.email || member.userId}</span>{member.role === "OWNER" || !canManage ? <span className="text-cyan-400 text-sm">{member.role}</span> : <Select aria-label={`Role for ${member.displayName || member.email || "team member"}`} className="w-36" value={member.role} disabled={updateRole.isPending} onChange={(e) => {
        setFeedback("");
        updateRole.mutate(
          { memberId: member.id, data: { role: e.target.value as "ADMIN" | "OPERATOR" | "VIEWER" } },
          {
            onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTeamMembersQueryKey() }),
            onError: () => setFeedback("Could not update the team member role."),
          },
        );
      }}><option value="ADMIN">Admin</option><option value="OPERATOR">Operator</option><option value="VIEWER">Viewer</option></Select>}</div>)}
    </Card>
    <Card className="p-6"><h2 className="font-bold text-white mb-4">Invitations</h2>
      {invitations.isLoading ? <p className="text-slate-400">Loading invitations…</p> : invitations.isError ? <p className="text-slate-400">Invitations could not be loaded.</p> : invitations.data?.length === 0 ? <p className="text-slate-400">No pending invitations.</p> : invitations.data?.map((item) => <div key={item.id} className="flex justify-between py-3 border-b border-white/5"><span className="text-slate-200">{item.email} <span className="text-slate-500">· {item.role}</span></span><Button size="sm" variant="outline" disabled={!canManage || !!item.revokedAt} onClick={() => revoke.mutate({ invitationId: item.id })}>{item.revokedAt ? "Revoked" : "Revoke"}</Button></div>)}
    </Card>
  </div></Shell>;
}