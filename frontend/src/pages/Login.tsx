import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import SecretariaAvatar from "@/components/SecretariaAvatar";
import { DemoPill } from "@/components/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, apiPost, apiGet } from "@/lib/api";
import type { SetupStatus, SetupIn } from "@/lib/catalog";
import { beginSession, useMe } from "@/lib/session";
import type { User } from "@/lib/types";

export default function Login() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const status = useQuery({ queryKey: ["setup-status"], queryFn: () => apiGet<SetupStatus>("/auth/setup"), retry: false });
  const setupRequired = status.data?.required === true;
  const setup = useMutation({
    mutationFn: (body: SetupIn) => apiPost<User>("/auth/setup", body),
    onSuccess: () => { beginSession(); toast.success("Administrador configurado"); navigate("/vehiculos", { replace: true }); },
    onError: (e) => { const detail = e instanceof ApiError ? (e.body as { detail?: unknown })?.detail : null; toast.error(typeof detail === "string" ? detail : "No se pudo configurar el acceso"); },
  });

  const login = useMutation({
    mutationFn: (body: { email: string; password: string }) => apiPost<User>("/auth/login", body),
    onSuccess: (user) => {
      beginSession();
      toast.success(`Bienvenido/a, ${user.name}`);
      navigate("/", { replace: true });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError && err.status === 401 ? "Credenciales incorrectas" : "No se pudo iniciar sesión");
    },
  });

  if (me) {
    return <Navigate to="/" replace />;
  }

  function googleSignIn() {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  }

  return (
    <div className="relative min-h-svh lg:grid lg:grid-cols-[1.1fr_0.9fr]" data-testid="login-page">
      {/* Brand side */}
      <div className="relative hidden overflow-hidden lg:block">
        <img src="/login-bg.jpeg" alt="" className="absolute inset-0 h-full w-full object-cover" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/92 via-slate-950/75 to-sky-950/70" aria-hidden />
        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center gap-3">
            <SecretariaAvatar size={52} />
            <div>
              <p className="text-lg font-bold tracking-tight text-white">SecretarIA</p>
              <p className="text-xs text-slate-300">Centrowagen Don Benito</p>
            </div>
          </div>
          <div className="max-w-lg">
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-white">
              Tu asistente comercial <span className="text-sky-400">Volkswagen</span>
            </h1>
            <p className="mt-4 text-[15px] leading-relaxed text-slate-300">
              Catálogo, stock, tarifas, financiación, promociones y argumentario — en un único panel,
              con trazabilidad de las fuentes y sin completar con suposiciones los datos que faltan.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-400">
              {["🚗 Catálogo", "📦 Stock", "💰 Precios", "💳 Financiación", "🔥 Promociones", "📊 Comparador"].map((t) => (
                <span key={t} className="rounded-full border border-slate-700/60 bg-slate-900/60 px-2.5 py-1">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <DemoPill />
        </div>
      </div>

      {/* Form side */}
      <div className="bg-page flex min-h-svh items-center justify-center px-5 py-12">
        <div className="glass-panel w-full max-w-md rounded-3xl p-7 md:p-9">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <SecretariaAvatar size={46} />
            <div>
              <p className="text-base font-bold tracking-tight text-white">SecretarIA</p>
              <p className="text-[11px] text-muted-foreground">Centrowagen Don Benito</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-white" data-testid="login-title">{setupRequired ? "Configura tu concesionario" : "Acceso al panel"}</h2>
          <p className="mt-1 text-sm text-muted-foreground" data-testid="login-description">{setupRequired ? "Crea el primer administrador con tu código privado de instalación. Sin datos de demostración." : "Identifícate para acceder a la información comercial."}</p>
          {status.isError && <p className="mt-3 text-sm text-amber-300" data-testid="login-connection-error">No se pudo comprobar la configuración. Revisa la conexión con el servidor.</p>}

          <form
            className="mt-7 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (setupRequired) setup.mutate({ name, email, password, setup_token: setupToken });
              else login.mutate({ email, password });
            }}
            data-testid="login-form"
          >
            {setupRequired && <><div className="space-y-1.5"><Label htmlFor="setup-name" data-testid="setup-name-label">Tu nombre</Label><Input id="setup-name" required minLength={2} value={name} onChange={e => setName(e.target.value)} data-testid="setup-name-input" /></div><div className="space-y-1.5"><Label htmlFor="setup-code" data-testid="setup-code-label">Código privado de instalación</Label><Input id="setup-code" type="password" required autoComplete="off" value={setupToken} onChange={e => setSetupToken(e.target.value)} data-testid="setup-code-input" /></div></>}
            <div className="space-y-1.5">
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                data-testid="login-email-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                autoComplete={setupRequired ? "new-password" : "current-password"}
                minLength={setupRequired ? 5 : undefined}
                maxLength={setupRequired ? 128 : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                data-testid="login-password-input"
              />
            </div>
            {setupRequired && <p className="text-xs text-slate-400" data-testid="setup-password-help">Elige una contraseña de al menos 5 caracteres. La configuración se cierra al crear el primer administrador.</p>}
            <Button type="submit" className="w-full glow-accent" disabled={login.isPending || setup.isPending || status.isPending || status.isError} data-testid="login-form-submit-button">
              {login.isPending || setup.isPending ? "Guardando…" : setupRequired ? "Crear administrador" : "Entrar"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-700/60" />
            <span className="text-[11px] uppercase tracking-wider text-slate-500">o</span>
            <span className="h-px flex-1 bg-slate-700/60" />
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={googleSignIn}
            data-testid="login-google-button"
            disabled={setupRequired}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
              <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8Z" />
              <path fill="#34A853" d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8H1.3v3.1A12 12 0 0 0 12 24Z" />
              <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
              <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A11.5 11.5 0 0 0 12 0 12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8Z" />
            </svg>
            Continuar con Google
          </Button>

          <p className="mt-6 text-xs leading-5 text-slate-500" data-testid="login-access-note">Acceso restringido al equipo autorizado. IA y correo requieren recuperar su configuración antes de utilizarlos.</p>
        </div>
      </div>
    </div>
  );
}
