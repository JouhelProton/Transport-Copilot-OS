import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth, DEV_ACCOUNTS, DEV_PASSWORD, loginSchema } from "@/lib/auth/session";
import type { Portal } from "@/lib/domain/types";
import { DemoBadge, Logo } from "./ui";
import { platform } from "@/lib/platform/runtime";

const META: Record<Portal, { title: string; text: string; home: string }> = {
  cliente: {
    title: "Acceso cliente",
    text: "Consulta tus envíos, documentos e incidencias.",
    home: "/cliente",
  },
  transportista: {
    title: "Acceso transportista",
    text: "Gestiona servicios, flota, conductores y facturación.",
    home: "/transportista",
  },
  conductor: {
    title: "Acceso conductor",
    text: "Tu servicio del día, llegada, entrega y POD.",
    home: "/conductor",
  },
};

export function LoginPage({ portal, reason }: { portal: Portal; reason?: string }) {
  const m = META[portal];
  const navigate = useNavigate();
  const demoUsers = DEV_ACCOUNTS[portal];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<string>();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = loginSchema.safeParse({ email, password });
    if (!p.success) {
      const f = p.error.flatten().fieldErrors;
      return setErrors({ email: f.email?.[0], password: f.password?.[0] });
    }
    setLoading(true);
    const r = await auth.signIn(portal, email, password);
    setLoading(false);
    if (!r.ok) return setErrors({ form: r.error });
    navigate({ to: m.home, replace: true });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-hero p-10 text-ink-foreground lg:flex">
        <Logo light />
        <div>
          <h2 className="text-3xl font-semibold">{m.title}</h2>
          <p className="mt-3 max-w-md text-ink-muted">{m.text}</p>
        </div>
        <p className="text-sm text-ink-muted">
          Cada rol tiene su propio acceso y su propio portal.
        </p>
      </div>
      <div className="flex flex-col justify-center px-5 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-md">
          {!platform.isDriverNativeApp && (
            <Link
              to="/acceso"
              className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Elegir otro acceso
            </Link>
          )}
          <div className="mb-6 flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{m.title}</h1>
            <DemoBadge label="Sesión segura" />
          </div>
          {reason && (
            <p
              role="alert"
              className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
            >
              {reason}
            </p>
          )}
          <form onSubmit={submit} noValidate className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email o usuario</Label>
              <Input
                id="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!errors.email}
                aria-describedby="email-err"
                className="h-11"
              />
              {errors.email && (
                <p id="email-err" className="text-sm text-destructive">
                  {errors.email}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Contraseña</Label>
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={async () => setResetMsg((await auth.requestPasswordReset()).message)}
                >
                  ¿Has olvidado tu contraseña?
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  aria-invalid={!!errors.password}
                  className="h-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground"
                  aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {show ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>
            {resetMsg && <p className="rounded-lg bg-muted p-3 text-sm">{resetMsg}</p>}
            {errors.form && (
              <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {errors.form}
              </p>
            )}
            <Button type="submit" className="h-11 w-full text-base" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Entrar
            </Button>
          </form>

          {import.meta.env.DEV && (
            <div className="mt-8 rounded-xl border border-dashed bg-demo/30 p-4">
              <p className="text-sm font-semibold text-demo-foreground">
                Credenciales locales de desarrollo
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Usuarios ficticios del seed. La contraseña está limitada a este entorno local.
              </p>
              <div className="mt-3 space-y-2">
                {demoUsers.map((u) => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => {
                      setEmail(u.email);
                      setPassword(DEV_PASSWORD);
                      setErrors({});
                    }}
                    className="flex w-full items-center justify-between rounded-lg border bg-card px-3 py-2 text-left text-sm hover:border-primary"
                  >
                    <span>
                      <span className="font-medium">{u.name}</span>
                      <span className="block text-xs text-muted-foreground">{u.email}</span>
                    </span>
                    <span className="rounded bg-muted px-2 py-0.5 text-xs">{u.role}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
