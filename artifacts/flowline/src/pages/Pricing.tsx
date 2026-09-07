import React from 'react';
import { Check, X, ArrowRight } from 'lucide-react';
import { useAuth } from '@clerk/react';
import { Link, useLocation } from 'wouter';
import { PublicLayout, StageTimeButton, StageTimeCard } from '../components/stagetime';
import { useCreateBillingCheckout } from '@workspace/api-client-react';

const CheckItem = ({ text }: { text: string }) => (
  <li className="flex items-start gap-3">
    <div className="mt-0.5 rounded-full bg-[var(--color-stagetime-green)]/20 p-0.5 border border-[var(--color-stagetime-green)]/30">
      <Check className="h-3 w-3 text-[var(--color-stagetime-green)]" />
    </div>
    <span className="text-sm text-[var(--color-stagetime-text-dim)]">{text}</span>
  </li>
);

const CrossItem = ({ text }: { text: string }) => (
  <li className="flex items-start gap-3 opacity-50">
    <div className="mt-0.5 rounded-full bg-white/5 p-0.5 border border-white/10">
      <X className="h-3 w-3 text-white/40" />
    </div>
    <span className="text-sm text-[var(--color-stagetime-text-dim)] line-through">{text}</span>
  </li>
);

export default function Pricing() {
  const { isSignedIn } = useAuth();
  const [, setLocation] = useLocation();
  const createCheckout = useCreateBillingCheckout();

  const handleSubscribe = async (plan: 'PRO' | 'BUSINESS') => {
    if (!isSignedIn) {
      setLocation('/sign-up');
      return;
    }
    
    try {
      const returnUrl = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}/billing`;
      const result = await createCheckout.mutateAsync({
        data: {
          plan,
          successUrl: `${returnUrl}?checkout=success`,
          cancelUrl: `${returnUrl}?checkout=cancelled`
        }
      });
      window.location.href = result.url;
    } catch (err) {
      console.error('Failed to create checkout session:', err);
    }
  };

  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto w-full px-6 py-20 lg:py-24 z-10 flex-1">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white display-font mb-6 fade-up">
            Simple, transparent pricing
          </h1>
          <p className="text-lg md:text-xl text-[var(--color-stagetime-text-dim)] fade-up-2">
            Start for free and upgrade when you need more events, displays, or team members.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-10 fade-up-3 items-center">
          {/* Starter Plan */}
          <StageTimeCard className="p-8 relative">
            <h3 className="text-2xl font-bold display-font mb-2">Starter</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-bold tracking-tight display-font">$0</span>
              <span className="text-[var(--color-stagetime-text-dim)]">/month</span>
            </div>
            <p className="text-sm text-[var(--color-stagetime-text-dim)] mb-8 min-h-[40px]">
              Perfect for individuals running small single-track events.
            </p>
            <Link href={isSignedIn ? "/events" : "/sign-up"} className="block w-full">
              <StageTimeButton variant="secondary" className="w-full">
                Get Started
              </StageTimeButton>
            </Link>
            <ul className="mt-8 space-y-4">
              <CheckItem text="1 Active event" />
              <CheckItem text="3 Speaker displays" />
              <CheckItem text="Basic timer modes" />
              <CrossItem text="Team collaboration" />
              <CrossItem text="Custom branding" />
            </ul>
          </StageTimeCard>

          {/* Pro Plan */}
          <StageTimeCard className="p-8 relative overflow-visible transform md:-translate-y-4 border-[var(--color-stagetime-blue)]/30 shadow-[0_20px_50px_rgba(77,163,255,0.15)] bg-[var(--color-stagetime-panel)]">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-4 bg-[var(--color-stagetime-blue)] text-black font-bold text-[10px] uppercase tracking-widest py-1.5 px-4 rounded-full shadow-[0_0_15px_rgba(77,163,255,0.5)]">
              Recommended
            </div>
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-[var(--color-stagetime-blue)]/5 to-transparent pointer-events-none" />
            
            <h3 className="text-2xl font-bold display-font text-[var(--color-stagetime-cyan)] mb-2 relative">Pro</h3>
            <div className="flex items-baseline gap-1 mb-6 relative">
              <span className="text-5xl font-bold tracking-tight display-font">$19</span>
              <span className="text-[var(--color-stagetime-text-dim)]">/month</span>
            </div>
            <p className="text-sm text-[var(--color-stagetime-text-dim)] mb-8 min-h-[40px] relative">
              Everything a professional operator needs for live productions.
            </p>
            <StageTimeButton 
              variant="primary" 
              className="w-full relative shadow-[0_0_20px_rgba(77,163,255,0.4)]"
              loading={createCheckout.isPending}
              onClick={() => handleSubscribe('PRO')}
            >
              Subscribe to Pro <ArrowRight className="h-4 w-4" />
            </StageTimeButton>
            <ul className="mt-8 space-y-4 relative">
              <CheckItem text="5 Active events" />
              <CheckItem text="10 Speaker displays" />
              <CheckItem text="Advanced timer modes" />
              <CheckItem text="Up to 3 team members" />
              <CheckItem text="Basic custom branding" />
            </ul>
          </StageTimeCard>

          {/* Business Plan */}
          <StageTimeCard className="p-8 relative">
            <h3 className="text-2xl font-bold display-font mb-2">Business</h3>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="text-4xl font-bold tracking-tight display-font">$59</span>
              <span className="text-[var(--color-stagetime-text-dim)]">/month</span>
            </div>
            <p className="text-sm text-[var(--color-stagetime-text-dim)] mb-8 min-h-[40px]">
              For large production teams and enterprise venues.
            </p>
            <StageTimeButton 
              variant="outline" 
              className="w-full bg-[rgba(0,0,0,0.2)]"
              loading={createCheckout.isPending}
              onClick={() => handleSubscribe('BUSINESS')}
            >
              Subscribe to Business
            </StageTimeButton>
            <ul className="mt-8 space-y-4">
              <CheckItem text="Unlimited active events" />
              <CheckItem text="Unlimited displays" />
              <CheckItem text="Unlimited team members" />
              <CheckItem text="Full custom branding" />
              <CheckItem text="Priority support" />
            </ul>
          </StageTimeCard>
        </div>
      </div>
    </PublicLayout>
  );
}