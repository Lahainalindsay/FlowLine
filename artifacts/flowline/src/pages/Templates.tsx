import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListTemplatesQueryKey, useCreateTemplate, useDeleteTemplate, useGetWorkspaceSummary, useListTemplates } from "@workspace/api-client-react";
import { Shell } from "../components/layout";
import { Button, Card, Input, Label } from "../components/ui";

export default function Templates() {
  const queryClient = useQueryClient();
  const { data: workspace } = useGetWorkspaceSummary();
  const { data, isLoading, isError, refetch } = useListTemplates();
  const create = useCreateTemplate({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey() }) } });
  const remove = useDeleteTemplate({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey() }) } });
  const [name, setName] = useState("");
  const canEdit = workspace ? ["OWNER", "ADMIN", "OPERATOR"].includes(workspace.role) : false;
  return <Shell><div className="max-w-4xl mx-auto space-y-6 fade-up">
    <div><h1 className="text-3xl font-bold text-white">Templates</h1><p className="text-slate-400 mt-1">Reusable run-of-show timer setups for this workspace.</p></div>
    <Card className="p-6">
      <form className="flex gap-3" onSubmit={(e) => { e.preventDefault(); if (name.trim() && canEdit) create.mutate({ data: { name: name.trim(), definition: {} } }, { onSuccess: () => setName("") }); }}>
        <div className="flex-1"><Label>New template</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Conference keynote" disabled={!canEdit || create.isPending} /></div>
        <Button className="self-end" variant="primary" disabled={!canEdit || !name.trim() || create.isPending}>{create.isPending ? "Saving…" : "Create template"}</Button>
      </form>
      {!canEdit && <p className="text-xs text-amber-300 mt-3">Your workspace role is read-only for templates.</p>}
    </Card>
    <Card className="p-6">
      {isLoading && <p className="text-slate-400">Loading templates…</p>}
      {isError && <div className="text-slate-400">Templates could not be loaded. <button className="text-cyan-400 underline" onClick={() => refetch()}>Try again</button></div>}
      {!isLoading && !isError && data?.length === 0 && <p className="text-slate-400">No templates yet. Create one to reuse a timing setup.</p>}
      <div className="space-y-3">{data?.map((template) => <div key={template.id} className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0">
        <div><div className="font-semibold text-white">{template.name}</div><div className="text-xs text-slate-500">{template.description || "No description"}</div></div>
        <Button variant="outline" size="sm" disabled={!canEdit || remove.isPending} onClick={() => remove.mutate({ templateId: template.id })}>Delete</Button>
      </div>)}</div>
    </Card>
  </div></Shell>;
}