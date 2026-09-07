import React from 'react';
import { SignIn, SignUp } from '@clerk/react';
import { PublicLayout } from '../components/stagetime';

export function Login() {
  return (
    <PublicLayout>
      <div className="flex-1 flex items-center justify-center p-6 fade-up">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold display-font mb-2">Welcome back</h1>
            <p className="text-[var(--color-stagetime-text-dim)]">Log in to your StageTime account.</p>
          </div>
          <div className="flex justify-center">
            <SignIn 
              routing="path" 
              path="/sign-in" 
              signUpUrl="/sign-up"
              forceRedirectUrl="/events"
            />
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

export function Register() {
  return (
    <PublicLayout>
      <div className="flex-1 flex items-center justify-center p-6 fade-up">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold display-font mb-2">Create your account</h1>
            <p className="text-[var(--color-stagetime-text-dim)]">Start tracking your events professionally.</p>
          </div>
          <div className="flex justify-center">
            <SignUp 
              routing="path" 
              path="/sign-up" 
              signInUrl="/sign-in"
              forceRedirectUrl="/events"
            />
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}