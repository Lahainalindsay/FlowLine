import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, useAuth } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { dark } from '@clerk/themes';
import { Redirect, Route, Switch, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';

// Pages
import Landing from './pages/Landing';
import Pricing from './pages/Pricing';
import { Login, Register } from './pages/Auth';
import Dashboard from './pages/Dashboard';
import NewEvent from './pages/NewEvent';
import EventWorkspace from './pages/EventWorkspace';
import AgendaImport from './pages/AgendaImport';
import PublicDisplay, { DisplayHost, DisplayPairing } from './pages/PublicDisplay';
import Settings from './pages/Settings';
import Templates from './pages/Templates';
import Team from './pages/Team';
import Billing from './pages/Billing';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);

const clerkAppearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: '#4DA3FF',
    colorBackground: '#0C1727',
    colorInputBackground: 'rgba(0,0,0,0.2)',
    colorInputText: '#EEF6FF',
    colorText: '#EEF6FF',
    colorTextSecondary: '#A8BAD0',
    fontFamily: 'Inter, sans-serif',
    borderRadius: '0.75rem',
  },
  elements: {
    card: '!border !border-[rgba(153,190,229,0.16)] !shadow-2xl !bg-[rgba(13,27,46,0.94)] backdrop-blur-xl',
    headerTitle: '!text-[#EEF6FF]',
    headerSubtitle: '!text-[#A8BAD0]',
    socialButtonsBlockButton: '!border-[rgba(153,190,229,0.16)] !bg-[rgba(7,17,31,0.72)] !text-[#EEF6FF] hover:!bg-[rgba(77,163,255,0.12)]',
    socialButtonsBlockButtonText: '!text-[#EEF6FF]',
    dividerLine: '!bg-[rgba(153,190,229,0.16)]',
    dividerText: '!text-[#A8BAD0]',
    formFieldLabel: '!text-[#EEF6FF]',
    formFieldInput: '!border-[rgba(153,190,229,0.24)] !bg-[rgba(7,17,31,0.82)] !text-[#EEF6FF] placeholder:!text-[#A8BAD0] focus:!border-[#4DA3FF] focus:!ring-[#4DA3FF]',
    formButtonPrimary: '!bg-[#4DA3FF] hover:!bg-[#68E1FF] !text-[#07111F] font-bold shadow-[0_0_15px_rgba(77,163,255,0.35)]',
    footerActionText: '!text-[#A8BAD0]',
    footerActionLink: '!text-[#4DA3FF] hover:!text-[#68E1FF]',
  }
};

function SignedIn({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  if (isLoaded && isSignedIn) return <>{children}</>;
  return null;
}

function SignedOut({ children }: { children: React.ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();
  if (isLoaded && !isSignedIn) return <>{children}</>;
  return null;
}

function ProtectedRoute({ component: Component, ...props }: { component: React.ComponentType<any>, [key: string]: any }) {
  return (
    <>
      <SignedIn>
        <Component {...props} />
      </SignedIn>
      <SignedOut>
        <Redirect to="/sign-in" />
      </SignedOut>
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ClerkProvider publishableKey={clerkPubKey} appearance={clerkAppearance}>
          <WouterRouter base={basePath}>
            <Switch>
              <Route path="/" component={() => (
                <>
                  <SignedIn><Dashboard /></SignedIn>
                  <SignedOut><Landing /></SignedOut>
                </>
              )} />

              <Route path="/events" component={() => (
                <ProtectedRoute component={Dashboard} />
              )} />
              <Route path="/app" component={() => (
                <ProtectedRoute component={Dashboard} />
              )} />

              <Route path="/pricing" component={Pricing} />
              <Route path="/sign-in" component={Login} />
              <Route path="/sign-up" component={Register} />

              <Route path="/events/new" component={() => <ProtectedRoute component={NewEvent} />} />
              <Route path="/events/:eventId" component={() => <ProtectedRoute component={EventWorkspace} />} />
              <Route path="/events/:eventId/import" component={() => <ProtectedRoute component={AgendaImport} />} />

              {/* Owner preview within the app (requires auth) */}
              <Route path="/events/:eventId/display/:displayId" component={(params: any) => <ProtectedRoute component={DisplayHost} preview eventId={params.params.eventId} displayId={params.params.displayId} />} />

              {/* Public unauthenticated routes */}
              <Route path="/display/:displayId/pair" component={DisplayPairing} />
              <Route path="/display/:displayId" component={PublicDisplay} />

              <Route path="/settings" component={() => <ProtectedRoute component={Settings} />} />
              <Route path="/templates" component={() => <ProtectedRoute component={Templates} />} />
              <Route path="/team" component={() => <ProtectedRoute component={Team} />} />
              <Route path="/billing" component={() => <ProtectedRoute component={Billing} />} />

              <Route component={NotFound} />
            </Switch>
          </WouterRouter>
        </ClerkProvider>
        <Toaster />
      </QueryClientProvider>
    </ErrorBoundary>
  );
}