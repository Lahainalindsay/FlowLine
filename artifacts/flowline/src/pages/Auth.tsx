import React from 'react';
import { SignIn, SignUp } from '@clerk/react';
import { PublicLayout } from '../components/layout';

export function Login() {
  return (
    <PublicLayout>
      <div className="flex-1 flex items-center justify-center py-12 px-4 fade-up">
        <div className="glass-panel p-2 rounded-2xl shadow-2xl border-white/10">
          <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
        </div>
      </div>
    </PublicLayout>
  );
}

export function Register() {
  return (
    <PublicLayout>
      <div className="flex-1 flex items-center justify-center py-12 px-4 fade-up">
        <div className="glass-panel p-2 rounded-2xl shadow-2xl border-white/10">
          <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
        </div>
      </div>
    </PublicLayout>
  );
}