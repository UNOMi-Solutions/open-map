import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import MainPage from "@/pages/MainPage";
import CookieConsentBanner from "@/components/CookieConsentBanner";

import "leaflet/dist/leaflet.css";

function Router() {
  return (
    <Switch>
      {/* Add pages below */}
      <Route path="/" component={MainPage} />
      {/* Verification page */}
      <Route path="/verify" component={MainPage} />
      {/* Reset page */}
      <Route path="/reset" component={MainPage} />
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
        <CookieConsentBanner />
      </TooltipProvider>
    </QueryClientProvider>
  );
}


export default App;

