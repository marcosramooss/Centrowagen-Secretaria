import { Navigate, Outlet } from "react-router-dom";

import SecretariaAvatar from "@/components/SecretariaAvatar";
import { ModeProvider } from "@/components/ModeContext";
import { useMe } from "@/lib/session";

export default function RequireAuth() {
  const { data, isPending } = useMe();

  if (isPending) {
    return (
      <div className="bg-page flex min-h-svh flex-col items-center justify-center gap-4" data-testid="auth-loading">
        <SecretariaAvatar size={72} pulse />
        <p className="text-sm text-muted-foreground">SecretarIA está comprobando tu sesión…</p>
      </div>
    );
  }

  if (!data) return <Navigate to="/login" replace />;

  return (
    <ModeProvider>
      <Outlet />
    </ModeProvider>
  );
}
