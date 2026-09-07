import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListInvitationsQueryKey, useCreateInvitation, useGetWorkspaceSummary, useListInvitations, useListTeamMembers, useRevokeInvitation } from "@workspace/api-client-react";
import { Shell } from "../components/layout";
import { Button, Card, Input, Label } from "../components/ui";

export default function Team() {
  const queryClient = useQueryClient(); const { data: workspace } = useGetWorkspaceSummary();
  const members = useListTeamMembers(); const invitations = useListInvitations();
  const invite = useCreateInvitation({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListInvitationsQueryKey() }) } });
  const revoke = useRevokeInvitation({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListInvitationsQueryKey() }) } });
  const [email, setEmail] = useState(""); const canManage = workspace ? ["OWNER", "ADMIN"].includes(workspace.role) : false;
  return <Shell><div className="max-w-4xl mx-auto space-y-6 fade-up">
    <div><h1 className="text-3xl font-bold text-white">Team</h1><p className="text-slate-400 mt-1">People with access to this workspace.</p></div>
    <Card className="p-6"><form className="flex gap-3" onSubmit={(e) => { e.preventDefault(); if (canManage && email) invite.mutate({ data: { email, role: "VIEWER" } }, { onSuccess: () => setEmail("") }); }}>
      <div className="flex-1"><Label>Invite by email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="crew@example.com" disabled={!canManage} /></div><Button className="self-end" variant="primary" disabled={!canManage || !email || invite.isPending}>Send invite</Button>
    </form>{!canManage && <p className="text-xs text-amber-300 mt-3">Only workspace owners and admins can invite team members.</p>}</Card>
    <Card className="p-6"><h2 className="font-bold text-white mb-4">Members</h2>
      {members.isLoading ? <p className="text-slate-400">Loading members…</p> : members.isError ? <p className="text-slate-400">Members could not be loaded.</p> : members.data?.map((member) => <div key={member.id} className="flex justify-between py-3 border-b border-white/5"><span className="text-slate-200">{member.displayName || member.email || member.userId}</span><span className="text-cyan-400 text-sm">{member.role}</span></div>)}
    </Card>
    <Card className="p-6"><h2 className="font-bold text-white mb-4">Invitations</h2>
      {invitations.isLoading ? <p className="text-slate-400">Loading invitations…</p> : invitations.isError ? <p className="text-slate-400">Invitations could not be loaded.</p> : invitations.data?.length === 0 ? <p className="text-slate-400">No pending invitations.</p> : invitations.data?.map((item) => <div key={item.id} className="flex justify-between py-3 border-b border-white/5"><span className="text-slate-200">{item.email} <span className="text-slate-500">· {item.role}</span></span><Button size="sm" variant="outline" disabled={!canManage || !!item.revokedAt} onClick={() => revoke.mutate({ invitationId: item.id })}>{item.revokedAt ? "Revoked" : "Revoke"}</Button></div>)}
    </Card>
  </div></Shell>;
}