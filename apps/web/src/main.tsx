import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider } from "@clerk/clerk-react";
import { App } from "./App";
import { ToasterProvider } from "./components/Toaster";
import "./index.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!PUBLISHABLE_KEY) {
  throw new Error(
    "VITE_CLERK_PUBLISHABLE_KEY is not set. Add it to apps/web/.env (local) or Vercel env vars (production).",
  );
}

// React Query config per BUILD_PLAN §5: 30s stale time, refetch on focus.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
  },
});

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("#root not found");

createRoot(rootEl).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={PUBLISHABLE_KEY}
      // Send users to /sign-in / /sign-up; both routes render Clerk's
      // hosted-style components inline (defined in App.tsx).
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      // After sign-in/up land back on the home page; the route guard in
      // App.tsx pulls them into the authenticated experience.
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    >
      <QueryClientProvider client={queryClient}>
        <ToasterProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ToasterProvider>
      </QueryClientProvider>
    </ClerkProvider>
  </StrictMode>,
);
