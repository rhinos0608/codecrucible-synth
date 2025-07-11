import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import Dashboard from "@/pages/dashboard";
import Landing from "@/pages/landing";
import NotFound from "@/pages/not-found";
import Analytics from "@/pages/analytics";
import Pricing from "@/pages/pricing";
import Teams from "@/pages/teams";
import SubscriptionSuccess from "@/pages/subscription-success";
import SubscriptionCancel from "@/pages/subscription-cancel";
import { VoiceSelectionProvider } from "@/contexts/voice-selection-context";

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Switch>
      {isLoading || !isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/subscription/success" component={SubscriptionSuccess} />
          <Route path="/subscription/cancel" component={SubscriptionCancel} />
        </>
      ) : (
        <>
          <Route path="/" component={Dashboard} />
          <Route path="/analytics" component={Analytics} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/teams" component={Teams} />
          <Route path="/subscription/success" component={SubscriptionSuccess} />
          <Route path="/subscription/cancel" component={SubscriptionCancel} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <VoiceSelectionProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </VoiceSelectionProvider>
    </QueryClientProvider>
  );
}

export default App;
