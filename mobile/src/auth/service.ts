import { ApiError } from "@/api/client";
import type { DriverApi } from "@/api/driver";
import type { SessionPayload } from "@/types/api";
import type { AuthStorage } from "./storage";

export class DriverRoleError extends Error {
  constructor() {
    super("Este usuario no tiene acceso a la aplicación de conductor.");
    this.name = "DriverRoleError";
  }
}

export class AuthService {
  constructor(
    private readonly api: DriverApi,
    private readonly storage: AuthStorage,
  ) {}

  private ensureDriver(session: SessionPayload) {
    if (session.activeMembership.role !== "DRIVER" || !session.driverId)
      throw new DriverRoleError();
    return session;
  }

  async login(email: string, password: string) {
    const login = await this.api.mobileLogin(email.trim().toLowerCase(), password);
    try {
      const session = this.ensureDriver(await this.api.me(login.sessionToken));
      await this.storage.set(login.sessionToken);
      return { token: login.sessionToken, session };
    } catch (error) {
      await this.api.logout(login.sessionToken).catch(() => undefined);
      await this.storage.clear();
      throw error;
    }
  }

  async restore() {
    const token = await this.storage.get();
    if (!token) return null;
    try {
      const session = this.ensureDriver(await this.api.me(token));
      return { token, session };
    } catch (error) {
      if (
        error instanceof DriverRoleError ||
        (error instanceof ApiError && ["UNAUTHORIZED", "FORBIDDEN"].includes(error.kind))
      )
        await this.storage.clear();
      throw error;
    }
  }

  async logout(token: string) {
    try {
      await this.api.logout(token);
    } catch {
      // Local logout must still complete when the API is temporarily unavailable.
    } finally {
      await this.storage.clear();
    }
  }

  clear() {
    return this.storage.clear();
  }
}
