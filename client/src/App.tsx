import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthContext } from "@/components/auth/AuthProvider";
import Dashboard from "@/pages/dashboard";
import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";
import Analytics from "@/pages/analytics";
import Pricing from "@/pages/pricing";
import Teams from "@/pages/teams";
import Onboarding from "@/pages/onboarding";
import Subscribe from "@/pages/subscribe";
import SubscriptionSuccess from "@/pages/subscription-success";
import SubscriptionCancel from "@/pages/subscription-cancel";
import { VoiceSelectionProvider } from "@/contexts/voice-selection-context";
import { AuthProvider } from "@/components/auth/AuthProvider";
import ErrorBoundary from "@/components/error-boundary";

function Router() {
  const { isAuthenticated, isLoading } = useAuthContext();

  return (
    <Switch>
      {/* Public routes available to all users */}
      <Route path="/pricing" component={Pricing} />
      <Route path="/subscribe" component={Subscribe} />
      <Route path="/subscription/success" component={SubscriptionSuccess} />
      <Route path="/subscription/cancel" component={SubscriptionCancel} />
      
      {/* Protected routes - redirect to landing if not authenticated */}
      <Route path="/analytics">
        {isAuthenticated ? <Analytics /> : <Landing />}
      </Route>
      <Route path="/teams">
        {isAuthenticated ? <Teams /> : <Landing />}
      </Route>
      <Route path="/onboarding">
        {isAuthenticated ? <Onboarding /> : <Landing />}
      </Route>
      
      {/* Main route */}
      <Route path="/">
        {isLoading ? <div>Loading...</div> : (isAuthenticated ? <Dashboard /> : <Landing />)}
      </Route>
      
      {/* 404 fallback */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <VoiceSelectionProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </VoiceSelectionProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
