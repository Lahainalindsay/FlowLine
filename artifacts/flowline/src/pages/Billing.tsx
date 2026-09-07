import React, { useState, useEffect } from "react";
import {
  useGetBillingEntitlement,
  useGetWorkspaceSummary,
  useCreateBillingCheckout,
  useCreateBillingPortal
} from "@workspace/api-client-react";
import { StageTimeLayout, StageTimeCard, StageTimeButton, StageTimeBadge } from "../components/stagetime";
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
    <StageTimeLayout>
      <div className="max-w-5xl mx-auto space-y-8 fade-up pb-20">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--color-stagetime-blue)]/10 border border-[var(--color-stagetime-blue)]/20 text-[var(--color-stagetime-cyan)] text-[10px] font-bold uppercase tracking-[0.2em] mb-4">
            Account Limits
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white display-font mb-4">Billing & Account</h1>
          <p className="text-[var(--color-stagetime-text-dim)] text-lg">Manage your workspace plan and current capacity.</p>
        </div>

        {statusMessage && (
          <div className={cn(
            "p-5 rounded-xl text-sm font-bold flex justify-between items-center transition-colors border",
            statusMessage.type === 'success' ? "bg-[var(--color-stagetime-green)]/10 text-[var(--color-stagetime-green)] border-[var(--color-stagetime-green)]/30" :
            statusMessage.type === 'error' ? "bg-[var(--color-stagetime-red)]/10 text-[var(--color-stagetime-red)] border-[var(--color-stagetime-red)]/30" :
            "bg-[var(--color-stagetime-text-dim)]/10 text-[var(--color-stagetime-text-dim)] border-[var(--color-stagetime-border)]"
          )}>
            <div className="flex items-center gap-3">
              {statusMessage.type === 'success' && <Check className="h-5 w-5" />}
              {statusMessage.text}
            </div>
            <button onClick={() => setStatusMessage(null)} className="opacity-70 hover:opacity-100 p-2 rounded-lg hover:bg-white/10 transition-colors"><X className="h-4 w-4" /></button>
          </div>
        )}

        {isLoading ? (
          <StageTimeCard className="p-16 flex flex-col items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-[var(--color-stagetime-blue)] mb-4" />
            <p className="text-[var(--color-stagetime-text-dim)] font-medium">Loading billing state...</p>
          </StageTimeCard>
        ) : isError || !entitlement || !summary ? (
          <StageTimeCard className="p-16 flex flex-col items-center justify-center border-[var(--color-stagetime-red)]/30 bg-[var(--color-stagetime-red)]/5">
            <p className="text-[var(--color-stagetime-text-dim)] mb-6">Billing state could not be loaded.</p>
            <StageTimeButton variant="outline" onClick={() => { refetchEntitlement(); refetchSummary(); }}>Try again</StageTimeButton>
          </StageTimeCard>
        ) : (
          <>
            {entitlement.billingManagementRequired && (
              <div className="bg-[var(--color-stagetime-orange)]/10 border border-[var(--color-stagetime-orange)]/30 rounded-xl p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between mb-8 shadow-inner">
                <div className="text-sm text-[var(--color-stagetime-orange)] font-medium flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-[var(--color-stagetime-orange)]" />
                  Your subscription requires attention. Please update your payment method or billing details.
                </div>
                {canManage && (
                  <StageTimeButton
                    variant="outline"
                    className="border-[var(--color-stagetime-orange)]/30 text-[var(--color-stagetime-orange)] hover:bg-[var(--color-stagetime-orange)]/20 whitespace-nowrap shrink-0"
                    onClick={handleManageBilling}
                    disabled={createPortal.isPending}
                    loading={createPortal.isPending}
                  >
                    <CreditCard className="h-4 w-4 mr-2" /> Resolve in Portal
                  </StageTimeButton>
                )}
              </div>
            )}

            <StageTimeCard className="p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-[var(--color-stagetime-border)] pb-8">
                <div>
                  <div className="flex items-center gap-4 mb-2">
                    <div className="text-2xl font-bold text-white display-font">Current Plan: <span className="text-[var(--color-stagetime-cyan)]">{entitlement.plan}</span></div>
                    <StageTimeBadge variant={entitlement.status === 'active' || entitlement.status === 'trialing' ? 'good' : 'warn'} className="px-3 py-1">
                      {entitlement.status}
                    </StageTimeBadge>
                  </div>
                </div>
                {entitlement.plan !== 'STARTER' && (
                  <StageTimeButton
                    variant="secondary"
                    onClick={handleManageBilling}
                    disabled={!canManage || createPortal.isPending || createCheckout.isPending}
                    loading={createPortal.isPending}
                  >
                    <CreditCard className="h-4 w-4 mr-2" /> Manage Billing
                  </StageTimeButton>
                )}
              </div>

              {!canManage && (
                <div className="bg-[var(--color-stagetime-orange)]/10 border border-[var(--color-stagetime-orange)]/20 rounded-xl p-5 text-sm text-[var(--color-stagetime-orange)] font-medium mb-8">
                  Only workspace Owners and Admins can manage billing or upgrade plans. Your current role is {summary.role}.
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-4">
                <div className="p-6 bg-[rgba(0,0,0,0.2)] rounded-xl border border-[var(--color-stagetime-border)]">
                  <div className="text-4xl font-bold text-white mb-2 display-font">{entitlement.entitlements.activeEvents}</div>
                  <div className="text-xs font-bold text-[var(--color-stagetime-text-dim)] uppercase tracking-widest">Active Events</div>
                </div>
                <div className="p-6 bg-[rgba(0,0,0,0.2)] rounded-xl border border-[var(--color-stagetime-border)]">
                  <div className="text-4xl font-bold text-white mb-2 display-font">{entitlement.entitlements.templates}</div>
                  <div className="text-xs font-bold text-[var(--color-stagetime-text-dim)] uppercase tracking-widest">Templates</div>
                </div>
                <div className="p-6 bg-[rgba(0,0,0,0.2)] rounded-xl border border-[var(--color-stagetime-border)]">
                  <div className="text-4xl font-bold text-white mb-2 display-font">{entitlement.entitlements.members}</div>
                  <div className="text-xs font-bold text-[var(--color-stagetime-text-dim)] uppercase tracking-widest">Members</div>
                </div>
              </div>
            </StageTimeCard>

            {(entitlement.plan === 'STARTER' || entitlement.plan === 'PRO') && (
              <div className="mt-16">
                <h2 className="text-2xl font-bold text-white mb-8 display-font">Available Upgrades</h2>
                <div className="grid md:grid-cols-2 gap-8">
                  {entitlement.plan === 'STARTER' && (
                    <StageTimeCard className="p-10 border-[var(--color-stagetime-blue)]/40 bg-[var(--color-stagetime-blue)]/5 flex flex-col relative overflow-hidden shadow-[0_0_30px_rgba(77,163,255,0.1)]">
                      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[var(--color-stagetime-cyan)] to-[var(--color-stagetime-blue)]" />
                      <div className="mb-6">
                        <h3 className="text-3xl font-bold text-white display-font">Pro</h3>
                        <div className="mt-3 text-4xl font-bold text-[var(--color-stagetime-cyan)] display-font">$19<span className="text-sm font-medium text-[var(--color-stagetime-text-dim)] font-sans tracking-normal">/mo</span></div>
                      </div>
                      <p className="text-[var(--color-stagetime-text-dim)] mb-10 flex-1 text-sm leading-relaxed">
                        Perfect for independent operators managing multiple events.
                      </p>
                      <ul className="space-y-4 mb-10 text-sm text-[var(--color-stagetime-text)] font-medium">
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-[var(--color-stagetime-cyan)]" /> 10 Active Events</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-[var(--color-stagetime-cyan)]" /> 20 Templates</li>
                        <li className="flex items-center gap-3"><Check className="h-5 w-5 text-[var(--color-stagetime-cyan)]" /> 5 Team Members</li>
                      </ul>
                      <StageTimeButton
                        variant="primary"
                        className="w-full h-14 text-base"
                        onClick={() => handleUpgrade('PRO')}
                        disabled={!canManage || createCheckout.isPending || createPortal.isPending || !entitlement.upgradesAvailable || entitlement.billingManagementRequired}
                        loading={createCheckout.isPending}
                      >
                        {entitlement.billingManagementRequired ? 'Action Required in Portal' :
                         !entitlement.upgradesAvailable ? 'Checkout temporarily unavailable' :
                         <>Upgrade to Pro <ArrowRight className="h-5 w-5 ml-2" /></>}
                      </StageTimeButton>
                    </StageTimeCard>
                  )}

                  <StageTimeCard className="p-10 border-[var(--color-stagetime-green)]/40 bg-[var(--color-stagetime-green)]/5 flex flex-col relative overflow-hidden shadow-[0_0_30px_rgba(107,234,156,0.1)]">
                    <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[var(--color-stagetime-green)] to-emerald-500" />
                    <div className="mb-6">
                      <h3 className="text-3xl font-bold text-white display-font">Business</h3>
                      <div className="mt-3 text-4xl font-bold text-[var(--color-stagetime-green)] display-font">$59<span className="text-sm font-medium text-[var(--color-stagetime-text-dim)] font-sans tracking-normal">/mo</span></div>
                    </div>
                    <p className="text-[var(--color-stagetime-text-dim)] mb-10 flex-1 text-sm leading-relaxed">
                      For production houses requiring maximum capacity.
                    </p>
                    <ul className="space-y-4 mb-10 text-sm text-[var(--color-stagetime-text)] font-medium">
                      <li className="flex items-center gap-3"><Check className="h-5 w-5 text-[var(--color-stagetime-green)]" /> 50 Active Events</li>
                      <li className="flex items-center gap-3"><Check className="h-5 w-5 text-[var(--color-stagetime-green)]" /> Unlimited Templates</li>
                      <li className="flex items-center gap-3"><Check className="h-5 w-5 text-[var(--color-stagetime-green)]" /> Unlimited Team Members</li>
                    </ul>
                    {entitlement.plan === 'STARTER' ? (
                      <StageTimeButton
                        variant="outline"
                        className="w-full h-14 text-base border-[var(--color-stagetime-green)]/30 text-[var(--color-stagetime-green)] hover:bg-[var(--color-stagetime-green)]/10"
                        onClick={() => handleUpgrade('BUSINESS')}
                        disabled={!canManage || createCheckout.isPending || createPortal.isPending || !entitlement.upgradesAvailable || entitlement.billingManagementRequired}
                        loading={createCheckout.isPending}
                      >
                        {entitlement.billingManagementRequired ? 'Action Required in Portal' :
                         !entitlement.upgradesAvailable ? 'Checkout temporarily unavailable' :
                         <>Upgrade to Business <ArrowRight className="h-5 w-5 ml-2" /></>}
                      </StageTimeButton>
                    ) : (
                      <StageTimeButton
                        variant="outline"
                        className="w-full h-14 text-base border-[var(--color-stagetime-green)]/30 text-[var(--color-stagetime-green)] hover:bg-[var(--color-stagetime-green)]/10"
                        onClick={() => handleManageBilling()}
                        disabled={!canManage || createPortal.isPending}
                        loading={createPortal.isPending}
                      >
                        Upgrade in billing portal <ArrowRight className="h-5 w-5 ml-2" />
                      </StageTimeButton>
                    )}
                  </StageTimeCard>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </StageTimeLayout>
  );
}