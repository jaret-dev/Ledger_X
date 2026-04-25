import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { ToasterProvider } from "./components/Toaster";
import "./index.css";

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
    <QueryClientProvider client={queryClient}>
      <ToasterProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ToasterProvider>
    </QueryClientProvider>
  </StrictMode>,
);
