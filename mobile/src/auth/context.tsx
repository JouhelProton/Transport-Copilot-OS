import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { driverApi } from "@/api/driver";
import { friendlyApiMessage } from "@/api/client";
import type { SessionPayload } from "@/types/api";
import { AuthService } from "./service";
import { authStorage } from "./storage";
import { stopTrackingBeforeLogout } from "@/tracking/controller";

type AuthStatus = "checking" | "authenticated" | "unauthenticated" | "unavailable";

interface AuthContextValue {
  status: AuthStatus;
  token: string | null;
  session: SessionPayload | null;
  startupError: string | null;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  expire(): Promise<void>;
  retry(): Promise<void>;
}

const service = new AuthService(driverApi, authStorage);
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<SessionPayload | null>(null);
  const [startupError, setStartupError] = useState<string | null>(null);

  const restore = useCallback(async () => {
    setStatus("checking");
    setStartupError(null);
    try {
      const restored = await service.restore();
      if (!restored) {
        setStatus("unauthenticated");
        return;
      }
      setToken(restored.token);
      setSession(restored.session);
      setStatus("authenticated");
    } catch (error) {
      setStartupError(friendlyApiMessage(error));
      setStatus("unavailable");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void restore(), 0);
    return () => clearTimeout(timer);
  }, [restore]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      token,
      session,
      startupError,
      async login(email, password) {
        const authenticated = await service.login(email, password);
        setToken(authenticated.token);
        setSession(authenticated.session);
        setStatus("authenticated");
      },
      async logout() {
        await stopTrackingBeforeLogout(token);
        if (token) await service.logout(token);
        else await service.clear();
        setToken(null);
        setSession(null);
        setStatus("unauthenticated");
      },
      async expire() {
        await stopTrackingBeforeLogout(token);
        await service.clear();
        setToken(null);
        setSession(null);
        setStatus("unauthenticated");
      },
      retry: restore,
    }),
    [restore, session, startupError, status, token],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe utilizarse dentro de AuthProvider");
  return value;
}
