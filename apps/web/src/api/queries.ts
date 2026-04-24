import { useQuery } from "@tanstack/react-query";
import { HealthResponse } from "@ledger/shared-types";
import { apiFetch } from "./client";

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async () => HealthResponse.parse(await apiFetch("/api/health")),
  });
}
