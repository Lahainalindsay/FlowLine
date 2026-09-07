import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClerkProvider, RedirectToSignIn, useAuth } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { dark } from '@clerk/themes';
import { Route, Switch, Router as WouterRouter } from 'wouter';
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
    colorPrimary: '#00E5FF',
    colorBackground: '#0B0F19',
    colorInputBackground: '#141A26',
    colorInputText: '#F8FAFC',
    colorText: '#F8FAFC',
    colorTextSecondary: '#94A3B8',
    fontFamily: 'Outfit, sans-serif',
    borderRadius: '0.75rem',
  },
  elements: {
    card: 'border border-white/10 shadow-2xl bg-[#0B0F19]/90 backdrop-blur-xl',
    formButtonPrimary: 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold',
    formFieldInput: 'border-white/10 focus:border-cyan-500',
    footerActionLink: 'text-cyan-400 hover:text-cyan-300',
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
        <RedirectToSignIn />
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