import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListTemplatesQueryKey, useCreateTemplate, useDeleteTemplate, useGetWorkspaceSummary, useListTemplates } from "@workspace/api-client-react";
import { StageTimeLayout, StageTimeCard, StageTimeButton, StageTimeInput, StageTimeLabel } from "../components/stagetime";
import { FileStack, Loader2, Plus, Trash2 } from "lucide-react";

export default function Templates() {
  const queryClient = useQueryClient();
  const { data: workspace } = useGetWorkspaceSummary();
  const { data, isLoading, isError, refetch } = useListTemplates();
  const create = useCreateTemplate({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey() }) } });
  const remove = useDeleteTemplate({ mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListTemplatesQueryKey() }) } });
  const [name, setName] = useState("");
  const canEdit = workspace ? ["OWNER", "ADMIN", "OPERATOR"].includes(workspace.role) : false;

  return (
    <StageTimeLayout>
      <div className="max-w-5xl mx-auto space-y-8 fade-up h-full flex flex-col">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-stagetime-blue)]/10 border border-[var(--color-stagetime-blue)]/20 text-[var(--color-stagetime-cyan)] text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
            Assets
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white display-font mb-4">Templates</h1>
          <p className="text-[var(--color-stagetime-text-dim)] text-lg">Reusable run-of-show timer setups for this workspace.</p>
        </div>

        <StageTimeCard className="p-8">
          <div className="flex items-center gap-3 mb-6 border-b border-[var(--color-stagetime-border)] pb-4">
            <FileStack className="h-5 w-5 text-[var(--color-stagetime-cyan)]" />
            <h2 className="font-bold text-white text-xl display-font">Template Library</h2>
          </div>

          <form className="flex flex-col sm:flex-row gap-4 mb-10" onSubmit={(e) => { e.preventDefault(); if (name.trim() && canEdit) create.mutate({ data: { name: name.trim(), definition: {} } }, { onSuccess: () => setName("") }); }}>
            <div className="flex-1">
              <StageTimeLabel>New template name</StageTimeLabel>
              <StageTimeInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Conference Keynote Block" disabled={!canEdit || create.isPending} />
            </div>
            <StageTimeButton className="sm:self-end h-11" variant="primary" disabled={!canEdit || !name.trim() || create.isPending} loading={create.isPending}>
              <Plus className="h-4 w-4 mr-2" /> {create.isPending ? "Creating" : "Create template"}
            </StageTimeButton>
          </form>
          {!canEdit && <p className="text-sm text-[var(--color-stagetime-orange)] mb-8 px-4 py-3 bg-[var(--color-stagetime-orange)]/10 rounded-lg">Your workspace role is read-only for templates.</p>}

          {isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-[var(--color-stagetime-blue)]" /></div>
          ) : isError ? (
            <div className="text-[var(--color-stagetime-red)] p-4 bg-[var(--color-stagetime-red)]/10 rounded-lg">
              Templates could not be loaded. <button className="text-[var(--color-stagetime-text)] underline font-bold" onClick={() => refetch()}>Try again</button>
            </div>
          ) : data?.length === 0 ? (
            <div className="text-center py-12 text-sm text-[var(--color-stagetime-text-dim)] border border-[var(--color-stagetime-border)] border-dashed rounded-xl bg-[rgba(0,0,0,0.2)]">
              No templates yet. Create one to reuse a timing setup across multiple events.
            </div>
          ) : (
            <div className="space-y-3">
              {data?.map((template) => (
                <div key={template.id} className="group flex items-center justify-between gap-4 p-5 rounded-xl bg-[rgba(0,0,0,0.2)] border border-[var(--color-stagetime-border)] hover:bg-[rgba(255,255,255,0.02)] transition-colors">
                  <div>
                    <div className="font-bold text-white text-lg display-font">{template.name}</div>
                    <div className="text-xs text-[var(--color-stagetime-text-dim)] mt-1">{template.description || "No description provided"}</div>
                  </div>
                  <StageTimeButton 
                    variant="danger" 
                    size="icon" 
                    disabled={!canEdit || remove.isPending} 
                    onClick={() => remove.mutate({ templateId: template.id })}
                    className="opacity-50 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="h-4 w-4" />
                  </StageTimeButton>
                </div>
              ))}
            </div>
          )}
        </StageTimeCard>
      </div>
    </StageTimeLayout>
  );
}