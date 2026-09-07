import React, { useState, useEffect } from "react";
import {
  useGetBillingEntitlement,
  useGetWorkspaceSummary,
  useCreateBillingCheckout,
  useCreateBillingPortal
} from "@workspace/api-client-react";
import { Shell } from "../components/layout";
import { Button, Card, Badge } from "../components/ui";
import { X, Check, ArrowRight, Loader2, CreditCard } from "lucide-react";
import { cn } from "../lib/utils";

export default function Billing() {
  const { data: entitlement, isLoading: isEntitlementLoading, isError: isEntitlementError, refetch: refetchEntitlement } = useGetBillingEntitlement();
  const { data: summary, isLoading: isSummaryLoading, isError: isSummaryError, refetch: refetchSummary } = useGetWorkspaceSummary();

  const createCheckout = useCreateBillingCheckout();
  const createPortal = useCreateBillingPortal();

  const [statusMessage, setStatusMessage] = useState<{ text: string, type: 'success' | 'cancelled' | 'error' } | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const checkoutStatus = urlParams.get('checkout');

    if (checkoutStatus === 'success') {
      setStatusMessage({ text: 'Checkout completed. We’re confirming your subscription; plan limits will refresh automatically.', type: 'success' });
      refetchEntitlement();
      refetchSummary();
      cleanUrl();
    } else if (checkoutStatus === 'cancelled') {
      setStatusMessage({ text: 'Checkout was cancelled. No changes were made.', type: 'cancelled' });
      cleanUrl();
    }
  }, [refetchEntitlement, refetchSummary]);

  useEffect(() => {
    let pollTimer: number;
    let pollCount = 0;
    const maxPolls = 6; // Poll for about 30 seconds (5s intervals)

    if (statusMessage?.type === 'success' && entitlement?.plan === 'STARTER') {
      pollTimer = window.setInterval(() => {
        pollCount++;
        refetchEntitlement();
        refetchSummary();

        if (pollCount >= maxPolls) {
          window.clearInterval(pollTimer);
        }
      }, 5000);
    }

    return () => {
      if (pollTimer) window.clearInterval(pollTimer);
    };
  }, [statusMessage, entitlement?.plan, refetchEntitlement, refetchSummary]);

  const cleanUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('checkout');
    window.history.replaceState({}, '', url.toString());
  };

  const isLoading = isEntitlementLoading || isSummaryLoading;
  const isError = isEntitlementError || isSummaryError;

  const getSafeBillingUrl = (query: string = '') => {
    const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
    return `${window.location.origin}${basePath}/billing${query}`;
  };

  const handleUpgrade = (plan: 'PRO' | 'BUSINESS') => {
    setStatusMessage(null);
    createCheckout.mutate(
      {
        data: {
          plan,
          successUrl: getSafeBillingUrl('?checkout=success'),
          cancelUrl: getSafeBillingUrl('?checkout=cancelled')
        }
      },
      {
        onSuccess: (res) => {
          window.location.assign(res.url);
        },
        onError: () => {
          setStatusMessage({ text: 'Failed to initiate checkout. Please try again.', type: 'error' });
        }
      }
    );
  };

  const handleManageBilling = () => {
    setStatusMessage(null);
    createPortal.mutate(
      {
        data: {
          returnUrl: getSafeBillingUrl()
        }
      },
      {
        onSuccess: (res) => {
          window.location.assign(res.url);
        },
        onError: () => {
          setStatusMessage({ text: 'Failed to access billing portal. Your plan may not support this yet.', type: 'error' });
        }
      }
    );
  };

  const canManage = summary?.role === 'OWNER' || summary?.role === 'ADMIN';

  return (
    <Shell>
      <div className="max-w-4xl mx-auto space-y-6 fade-up pb-20">
        <div>
          <h1 className="text-3xl font-bold text-white">Billing & account</h1>
          <p className="text-slate-400 mt-1">Manage your workspace plan and current limits.</p>
        </div>

        {statusMessage && (
          <div className={cn(
            "p-4 rounded-xl text-sm font-bold flex justify-between items-center transition-colors border",
            statusMessage.type === 'success' ? "bg-green-500/10 text-green-400 border-green-500/20" :
            statusMessage.type === 'error' ? "bg-red-500/10 text-red-400 border-red-500/20" :
            "bg-slate-500/10 text-slate-300 border-slate-500/20"
          )}>
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' && <Check className="h-4 w-4" />}
              {statusMessage.text}
            </div>
            <button onClick={() => setStatusMessage(null)} className="opacity-70 hover:opacity-100 p-1"><X className="h-4 w-4" /></button>
          </div>
        )}

        {isLoading ? (
          <Card className="p-12 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-500 mb-4" />
            <p className="text-slate-400">Loading billing state...</p>
          </Card>
        ) : isError || !entitlement || !summary ? (
          <Card className="p-12 flex flex-col items-center justify-center border-red-500/20">
            <p className="text-slate-400 mb-4">Billing state could not be loaded.</p>
            <Button variant="outline" onClick={() => { refetchEntitlement(); refetchSummary(); }}>Try again</Button>
          </Card>
        ) : (
          <>
            {entitlement.billingManagementRequired && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
                <div className="text-sm text-amber-400 font-medium">
                  Your subscription requires attention. Please update your payment method or billing details.
                </div>
                {canManage && (
                  <Button
                    variant="outline"
                    className="border-amber-500/30 text-amber-400 hover:bg-amber-500/20 whitespace-nowrap shrink-0"
                    onClick={handleManageBilling}
                    disabled={createPortal.isPending}
                    loading={createPortal.isPending}
                  >
                    <CreditCard className="h-4 w-4 mr-2" /> Resolve in Portal
                  </Button>
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-xl font-bold text-white">Current Plan: <span className="text-cyan-400">{entitlement.plan}</span></div>
                  <Badge variant={entitlement.status === 'active' || entitlement.status === 'trialing' ? 'good' : 'warn'}>{entitlement.status}</Badge>
                </div>
              </div>
              {entitlement.plan !== 'STARTER' && (
                <Button
                  variant="outline"
                  onClick={handleManageBilling}
                  disabled={!canManage || createPortal.isPending || createCheckout.isPending}
                  loading={createPortal.isPending}
                >
                  <CreditCard className="h-4 w-4 mr-2" /> Manage Billing
                </Button>
              )}
            </div>

            {!canManage && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-sm text-amber-400 font-medium">
                Only workspace Owners and Admins can manage billing or upgrade plans. Your current role is {summary.role}.
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card className="p-6 bg-black/40 border-white/5">
                <div className="text-3xl font-bold text-white mb-1">{entitlement.entitlements.activeEvents}</div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Active Events</div>
              </Card>
              <Card className="p-6 bg-black/40 border-white/5">
                <div className="text-3xl font-bold text-white mb-1">{entitlement.entitlements.templates}</div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Templates</div>
              </Card>
              <Card className="p-6 bg-black/40 border-white/5">
                <div className="text-3xl font-bold text-white mb-1">{entitlement.entitlements.members}</div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Members</div>
              </Card>
            </div>

            {(entitlement.plan === 'STARTER' || entitlement.plan === 'PRO') && (
              <div className="mt-12">
                <h2 className="text-xl font-bold text-white mb-6">Available Upgrades</h2>
                <div className="grid md:grid-cols-2 gap-6">
                  {entitlement.plan === 'STARTER' && (
                    <Card className="p-8 border-cyan-500/30 bg-cyan-950/10 flex flex-col relative overflow-hidden">
                      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-400 to-blue-500" />
                      <div className="mb-4">
                        <h3 className="text-2xl font-bold text-white">Pro</h3>
                        <div className="mt-2 text-3xl font-bold text-cyan-400">$19<span className="text-sm font-medium text-slate-500">/mo</span></div>
                      </div>
                      <p className="text-sm text-slate-400 mb-8 flex-1">
                        Perfect for independent operators managing multiple events.
                      </p>
                      <ul className="space-y-3 mb-8 text-sm text-slate-300">
                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-cyan-500" /> 10 Active Events</li>
                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-cyan-500" /> 20 Templates</li>
                        <li className="flex items-center gap-2"><Check className="h-4 w-4 text-cyan-500" /> 5 Team Members</li>
                      </ul>
                      <Button
                        variant="primary"
                        className="w-full h-12"
                        onClick={() => handleUpgrade('PRO')}
                        disabled={!canManage || createCheckout.isPending || createPortal.isPending || !entitlement.upgradesAvailable || entitlement.billingManagementRequired}
                        loading={createCheckout.isPending}
                      >
                        {entitlement.billingManagementRequired ? 'Action Required in Portal' :
                         !entitlement.upgradesAvailable ? 'Checkout temporarily unavailable' :
                         <>Upgrade to Pro <ArrowRight className="h-4 w-4 ml-2" /></>}
                      </Button>
                    </Card>
                  )}

                  <Card className="p-8 border-[#00FF9D]/30 bg-[#00FF9D]/5 flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[#00FF9D] to-emerald-500" />
                    <div className="mb-4">
                      <h3 className="text-2xl font-bold text-white">Business</h3>
                      <div className="mt-2 text-3xl font-bold text-[#00FF9D]">$59<span className="text-sm font-medium text-slate-500">/mo</span></div>
                    </div>
                    <p className="text-sm text-slate-400 mb-8 flex-1">
                      For production houses requiring maximum capacity.
                    </p>
                    <ul className="space-y-3 mb-8 text-sm text-slate-300">
                      <li className="flex items-center gap-2"><Check className="h-4 w-4 text-[#00FF9D]" /> 50 Active Events</li>
                      <li className="flex items-center gap-2"><Check className="h-4 w-4 text-[#00FF9D]" /> Unlimited Templates</li>
                      <li className="flex items-center gap-2"><Check className="h-4 w-4 text-[#00FF9D]" /> Unlimited Team Members</li>
                    </ul>
                    {entitlement.plan === 'STARTER' ? (
                      <Button
                        variant="outline"
                        className="w-full h-12 border-[#00FF9D]/30 text-[#00FF9D] hover:bg-[#00FF9D]/10 disabled:opacity-50"
                        onClick={() => handleUpgrade('BUSINESS')}
                        disabled={!canManage || createCheckout.isPending || createPortal.isPending || !entitlement.upgradesAvailable || entitlement.billingManagementRequired}
                        loading={createCheckout.isPending}
                      >
                        {entitlement.billingManagementRequired ? 'Action Required in Portal' :
                         !entitlement.upgradesAvailable ? 'Checkout temporarily unavailable' :
                         <>Upgrade to Business <ArrowRight className="h-4 w-4 ml-2" /></>}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full h-12 border-[#00FF9D]/30 text-[#00FF9D] hover:bg-[#00FF9D]/10"
                        onClick={() => handleManageBilling()}
                        disabled={!canManage || createPortal.isPending}
                        loading={createPortal.isPending}
                      >
                        Upgrade in billing portal <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    )}
                  </Card>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}
