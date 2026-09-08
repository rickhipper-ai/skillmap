import { APIError } from 'better-auth';

import {
  decodePasswordResetToken,
  decodeVerificationToken,
  type SkillMapsAuth,
} from '../../plugins/auth.js';
import { HttpProblem } from '../../plugins/problem-details.js';
import type { AuditService } from '../audit/service.js';
import { IdentityRepository, type LiveSession } from './repository.js';

const sessionCookieName = '__Host-skillmaps-session';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function authHeaders(token: string): Headers {
  return new Headers({ cookie: `${sessionCookieName}=${token}` });
}

function invalidToken(code: string): HttpProblem {
  return new HttpProblem({ status: 410, title: 'Gone', code });
}

export class IdentityService {
  constructor(
    readonly repository: IdentityRepository,
    readonly auth: SkillMapsAuth,
    private readonly audit: AuditService,
    private readonly autoVerifyEmail = false,
  ) {}

  async register(input: { name: string; email: string; password: string }) {
    const email = normalizeEmail(input.email);
    if (await this.repository.emailExists(email)) {
      throw new HttpProblem({ status: 409, title: 'Conflict', code: 'EMAIL_ALREADY_REGISTERED' });
    }
    try {
      await this.auth.api.signUpEmail({
        body: { name: input.name.trim(), email, password: input.password },
      });
    } catch (error) {
      if (error instanceof APIError && error.status === 'UNPROCESSABLE_ENTITY') {
        throw new HttpProblem({
          status: 409,
          title: 'Conflict',
          code: 'EMAIL_ALREADY_REGISTERED',
        });
      }
      throw error;
    }
    await this.audit.record({
      eventType: 'registration_created',
      outcome: 'success',
    });
    return this.autoVerifyEmail
      ? ({ status: 'active', emailVerification: 'automatic' } as const)
      : ({ status: 'pending_verification', emailVerification: 'required' } as const);
  }

  async requestVerification(email: string): Promise<void> {
    try {
      await this.auth.api.sendVerificationOTP({
        body: { email: normalizeEmail(email), type: 'email-verification' },
      });
    } catch (error) {
      if (!(error instanceof APIError)) throw error;
    }
  }

  async verifyEmail(token: string): Promise<void> {
    const verification = decodeVerificationToken(token);
    if (!verification) throw invalidToken('VERIFICATION_TOKEN_INVALID');
    try {
      await this.auth.api.verifyEmailOTP({ body: verification });
    } catch {
      throw invalidToken('VERIFICATION_TOKEN_INVALID');
    }
    await this.audit.record({ eventType: 'email_verified', outcome: 'success' });
  }

  async login(email: string, password: string) {
    try {
      const result = await this.auth.api.signInEmail({
        body: { email: normalizeEmail(email), password, rememberMe: true },
        returnHeaders: true,
      });
      const roles = await this.repository.findRoles(result.response.user.id);
      const cookie = result.headers.get('set-cookie');
      if (!cookie) throw new Error('Better Auth did not issue a session cookie');
      await this.audit.record({
        eventType: 'session_login',
        actorId: result.response.user.id,
        outcome: 'success',
      });
      return { cookie, userId: result.response.user.id, roles };
    } catch {
      await this.audit.record({ eventType: 'session_login', outcome: 'denied' });
      throw new HttpProblem({ status: 401, title: 'Unauthorized', code: 'INVALID_CREDENTIALS' });
    }
  }

  async findLiveSession(token: string): Promise<LiveSession | undefined> {
    const result = await this.auth.api.getSession({
      headers: authHeaders(token),
      query: { disableCookieCache: true },
    });
    if (!result || result.user.status !== 'active') return undefined;
    return {
      sessionId: result.session.id,
      token,
      userId: result.user.id,
      status: 'active',
      roles: await this.repository.findRoles(result.user.id),
      authenticatedAt: result.session.createdAt,
    };
  }

  async logout(token: string): Promise<void> {
    await this.auth.api.signOut({ headers: authHeaders(token) });
  }

  async requestPasswordReset(email: string): Promise<void> {
    await this.auth.api.requestPasswordReset({ body: { email: normalizeEmail(email) } });
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const authToken = decodePasswordResetToken(token);
    if (!authToken) throw invalidToken('PASSWORD_RESET_TOKEN_INVALID');
    try {
      await this.auth.api.resetPassword({ body: { token: authToken, newPassword } });
    } catch {
      throw invalidToken('PASSWORD_RESET_TOKEN_INVALID');
    }
    await this.audit.record({ eventType: 'password_reset', outcome: 'success' });
  }

  async verifyCurrentPassword(token: string, password: string): Promise<void> {
    try {
      await this.auth.api.verifyPassword({
        headers: authHeaders(token),
        body: { password },
      });
    } catch (error) {
      if (error instanceof APIError) {
        throw new HttpProblem({ status: 401, title: 'Unauthorized', code: 'RECENT_AUTH_REQUIRED' });
      }
      throw error;
    }
  }
}
