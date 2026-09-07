import React from "react";
import { useGetBillingEntitlement } from "@workspace/api-client-react";
import { Shell } from "../components/layout";
import { Button, Card } from "../components/ui";

export default function Billing() {
  const { data, isLoading, isError, refetch } = useGetBillingEntitlement();
  return <Shell><div className="max-w-3xl mx-auto space-y-6 fade-up"><div><h1 className="text-3xl font-bold text-white">Billing & account</h1><p className="text-slate-400 mt-1">Your workspace plan and current limits.</p></div>
    <Card className="p-7">{isLoading && <p className="text-slate-400">Loading billing state…</p>}{isError && <p className="text-slate-400">Billing state could not be loaded. <button onClick={() => refetch()} className="text-cyan-400 underline">Try again</button></p>}
    {data && <><div className="text-cyan-400 font-bold text-lg">{data.plan} plan</div><p className="text-slate-400 mt-1">Status: {data.status}</p><div className="grid grid-cols-3 gap-3 mt-6 text-center"><div><b className="text-white">{data.entitlements.activeEvents}</b><div className="text-xs text-slate-500">active events</div></div><div><b className="text-white">{data.entitlements.templates}</b><div className="text-xs text-slate-500">templates</div></div><div><b className="text-white">{data.entitlements.members}</b><div className="text-xs text-slate-500">members</div></div></div><div className="mt-7 border-t border-white/10 pt-5"><p className="text-sm text-slate-400">Upgrades are unavailable until billing is configured. No payment will be taken from this page.</p><Button className="mt-4" variant="outline" disabled>Upgrade unavailable</Button></div></>}</Card>
  </div></Shell>;
}