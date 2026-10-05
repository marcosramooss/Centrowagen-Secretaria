// Session boundary — this module owns the query cache. Never hand-roll logout:
// clearing only the server session would leak the previous account's cache to the next login.
import { useQuery } from "@tanstack/react-query";

import { apiGet, apiPost } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import type { User } from "@/lib/types";

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiGet<User>("/auth/me"),
    retry: false,
    staleTime: Infinity,
  });
}

export function beginSession() {
  void queryClient.invalidateQueries();
}

export async function endSession() {
  try {
    await apiPost("/auth/logout", {});
  } finally {
    queryClient.clear();
  }
}
