import React from 'react';
import { PublicLayout } from '../components/layout';
import { Button, Card } from '../components/ui';
import { Check } from 'lucide-react';
import { Link } from 'wouter';

export default function Pricing() {
  return (
    <PublicLayout>
      <div className="py-20 px-6 max-w-5xl mx-auto w-full text-center fade-up">
        <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">Clear pricing for <span className="text-cyan-400">every stage.</span></h1>
        <p className="text-slate-400 max-w-2xl mx-auto mb-16 text-lg">Whether you are running a single workshop or producing global conferences, StageTime scales with your needs.</p>

        <div className="grid md:grid-cols-3 gap-8 text-left">
          {[
            { name: "Starter", price: "$0", desc: "Perfect for small meetups and workshops.", features: ["1 Active Event", "2 Operator Seats", "Basic Timer Views", "Email Support"] },
            { name: "Pro", price: "$49", desc: "For professional producers and regular events.", features: ["Unlimited Events", "10 Operator Seats", "Custom Branding", "Advanced Cues", "Priority Support"], popular: true },
            { name: "Enterprise", price: "Custom", desc: "For large scale productions and agencies.", features: ["Unlimited Everything", "SAML SSO", "SLA Guarantee", "Dedicated Success Manager"] }
          ].map((plan, i) => (
            <Card key={i} className={`p-8 relative ${plan.popular ? 'border-cyan-500/50 shadow-[0_0_30px_rgba(0,229,255,0.1)]' : ''}`}>
              {plan.popular && <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-400 to-blue-500"></div>}
              <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
              <div className="text-3xl font-bold mb-4">{plan.price}<span className="text-sm font-normal text-slate-500">/mo</span></div>
              <p className="text-sm text-slate-400 mb-8">{plan.desc}</p>
              <ul className="space-y-4 mb-8">
                {plan.features.map(f => (
                  <li key={f} className="flex gap-3 text-sm text-slate-300">
                    <Check className="h-5 w-5 text-cyan-500 shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link href="/sign-up">
                <Button variant={plan.popular ? 'primary' : 'outline'} className="w-full">
                  {plan.price === 'Custom' ? 'Contact Sales' : 'Get Started'}
                </Button>
              </Link>
            </Card>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}