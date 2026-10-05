import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import SecretariaAvatar from "@/components/SecretariaAvatar";
import { apiPost } from "@/lib/api";
import { beginSession } from "@/lib/session";

export default function AuthCallback() {
  const navigate = useNavigate();
  const processed = useRef(false);

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;
    const sessionId = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("session_id");
    if (!sessionId) {
      navigate("/login", { replace: true });
      return;
    }
    void (async () => {
      try {
        await apiPost("/auth/google", { session_id: sessionId });
        beginSession();
        navigate("/", { replace: true });
      } catch {
        navigate("/login", { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="bg-page flex min-h-svh flex-col items-center justify-center gap-4" data-testid="auth-callback">
      <SecretariaAvatar size={72} pulse />
      <p className="text-sm text-muted-foreground">Completando el acceso con Google…</p>
    </div>
  );
}
