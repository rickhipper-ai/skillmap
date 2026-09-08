import { createHash, randomBytes } from 'node:crypto';

import { kyselyAdapter } from '@better-auth/kysely-adapter';
import { hash, verify } from 'argon2';
import {
  betterAuth,
  type BetterAuthOptions,
  type DBAdapter,
  type DBTransactionAdapter,
  type JoinOption,
  type Where,
} from 'better-auth';
import { emailOTP } from 'better-auth/plugins/email-otp';
import { sql, type Kysely } from 'kysely';

import { emailFromTemplate, type EmailPort } from '../modules/identity/email.js';
import { passwordResetTemplate, verificationTemplate } from '../modules/identity/templates.js';
import type { FoundationDatabase } from './database.js';

const tokenLifetimeSeconds = 30 * 60;

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    type: 2,
    memoryCost: 65_536,
    timeCost: 3,
    parallelism: 1,
  });
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}

export function encodeVerificationToken(email: string, otp: string): string {
  return Buffer.from(JSON.stringify([email.toLowerCase(), otp]), 'utf8').toString('base64url');
}

export function decodeVerificationToken(token: string): { email: string; otp: string } | undefined {
  try {
    const value: unknown = JSON.parse(Buffer.from(token, 'base64url').toString('utf8'));
    if (
      !Array.isArray(value) ||
      value.length !== 2 ||
      typeof value[0] !== 'string' ||
      typeof value[1] !== 'string'
    ) {
      return undefined;
    }
    return { email: value[0], otp: value[1] };
  } catch {
    return undefined;
  }
}

export function encodePasswordResetToken(token: string): string {
  return Buffer.from(token, 'utf8').toString('base64url');
}

export function decodePasswordResetToken(token: string): string | undefined {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    return decoded && encodePasswordResetToken(decoded) === token ? decoded : undefined;
  } catch {
    return undefined;
  }
}

function hashedWhere(model: string, where: Where[] | undefined): Where[] | undefined {
  if (model !== 'session' || !where) return where;
  return where.map((condition) => {
    if (condition.field !== 'token') return condition;
    return {
      ...condition,
      value: Array.isArray(condition.value)
        ? condition.value.map((value) => hashOpaqueToken(String(value)))
        : hashOpaqueToken(String(condition.value)),
    };
  });
}

function inputTokens(where: Where[] | undefined): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const condition of where ?? []) {
    if (condition.field !== 'token') continue;
    for (const value of Array.isArray(condition.value) ? condition.value : [condition.value]) {
      const token = String(value);
      tokens.set(hashOpaqueToken(token), token);
    }
  }
  return tokens;
}

function restoreKnownSessionToken<T>(model: string, value: T, tokens: Map<string, string>): T {
  if (model !== 'session' || !value || typeof value !== 'object' || !('token' in value))
    return value;
  const storedToken = String(value.token);
  const token = tokens.get(storedToken);
  return token ? ({ ...value, token } as T) : value;
}

function withHashedSessionTokens(base: DBAdapter): DBAdapter {
  const adapter = { ...base } as DBAdapter;

  adapter.create = (async (input: {
    model: string;
    data: Record<string, unknown>;
    select?: string[];
    forceAllowId?: boolean;
  }) => {
    const rawToken = input.model === 'session' ? String(input.data.token) : undefined;
    const created = await base.create({
      ...input,
      data:
        rawToken === undefined ? input.data : { ...input.data, token: hashOpaqueToken(rawToken) },
    });
    return rawToken ? { ...created, token: rawToken } : created;
  }) as DBAdapter['create'];

  adapter.findOne = (async (input: {
    model: string;
    where: Where[];
    select?: string[];
    join?: JoinOption;
  }) => {
    const tokens = inputTokens(input.where);
    const found = await base.findOne({
      ...input,
      where: hashedWhere(input.model, input.where) ?? [],
    });
    return restoreKnownSessionToken(input.model, found, tokens);
  }) as DBAdapter['findOne'];

  adapter.findMany = (async (input: {
    model: string;
    where?: Where[];
    limit?: number;
    select?: string[];
    sortBy?: { field: string; direction: 'asc' | 'desc' };
    offset?: number;
    join?: JoinOption;
  }) => {
    const tokens = inputTokens(input.where);
    const rows = await base.findMany({ ...input, where: hashedWhere(input.model, input.where) });
    return rows.map((row) => restoreKnownSessionToken(input.model, row, tokens));
  }) as DBAdapter['findMany'];

  adapter.count = ((input: { model: string; where?: Where[] }) =>
    base.count({ ...input, where: hashedWhere(input.model, input.where) })) as DBAdapter['count'];

  adapter.update = (async (input: {
    model: string;
    where: Where[];
    update: Record<string, unknown>;
  }) => {
    const tokens = inputTokens(input.where);
    const updated = await base.update({
      ...input,
      where: hashedWhere(input.model, input.where) ?? [],
      update:
        input.model === 'session' && typeof input.update.token === 'string'
          ? { ...input.update, token: hashOpaqueToken(input.update.token) }
          : input.update,
    });
    return restoreKnownSessionToken(input.model, updated, tokens);
  }) as DBAdapter['update'];

  adapter.updateMany = ((input: {
    model: string;
    where: Where[];
    update: Record<string, unknown>;
  }) =>
    base.updateMany({
      ...input,
      where: hashedWhere(input.model, input.where) ?? [],
      update:
        input.model === 'session' && typeof input.update.token === 'string'
          ? { ...input.update, token: hashOpaqueToken(input.update.token) }
          : input.update,
    })) as DBAdapter['updateMany'];

  adapter.delete = ((input: { model: string; where: Where[] }) =>
    base.delete({
      ...input,
      where: hashedWhere(input.model, input.where) ?? [],
    })) as DBAdapter['delete'];

  adapter.deleteMany = ((input: { model: string; where: Where[] }) =>
    base.deleteMany({
      ...input,
      where: hashedWhere(input.model, input.where) ?? [],
    })) as DBAdapter['deleteMany'];

  adapter.consumeOne = (async (input: { model: string; where: Where[] }) => {
    const tokens = inputTokens(input.where);
    const consumed = await base.consumeOne({
      ...input,
      where: hashedWhere(input.model, input.where) ?? [],
    });
    return restoreKnownSessionToken(input.model, consumed, tokens);
  }) as DBAdapter['consumeOne'];

  adapter.incrementOne = (async (input: {
    model: string;
    where: Where[];
    increment: Record<string, number>;
    set?: Record<string, unknown>;
  }) => {
    const tokens = inputTokens(input.where);
    const updated = await base.incrementOne({
      ...input,
      where: hashedWhere(input.model, input.where) ?? [],
    });
    return restoreKnownSessionToken(input.model, updated, tokens);
  }) as DBAdapter['incrementOne'];

  adapter.transaction = <R>(callback: (transaction: DBTransactionAdapter) => Promise<R>) =>
    base.transaction<R>((transaction) =>
      callback(withHashedSessionTokens(transaction as DBAdapter) as DBTransactionAdapter),
    );

  return adapter;
}

function authOptions(
  db: Kysely<FoundationDatabase>,
  secret: string,
  webOrigin: string,
  email: EmailPort,
  autoVerifyEmail = false,
) {
  return {
    appName: 'SKILL MAPS',
    baseURL: `${webOrigin}/api/auth`,
    database: (options: BetterAuthOptions) =>
      withHashedSessionTokens(kyselyAdapter(db, { type: 'postgres', transaction: true })(options)),
    secret,
    trustedOrigins: [webOrigin],
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      requireEmailVerification: !autoVerifyEmail,
      revokeSessionsOnPasswordReset: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: tokenLifetimeSeconds,
      sendResetPassword: async ({ user, token }) => {
        await email.send(
          emailFromTemplate(
            user.email,
            passwordResetTemplate(webOrigin, encodePasswordResetToken(token)),
          ),
        );
      },
      password: {
        hash: hashPassword,
        verify: async ({ hash: passwordHash, password }) => verifyPassword(passwordHash, password),
      },
    },
    emailVerification: {
      sendOnSignUp: !autoVerifyEmail,
      autoSignInAfterVerification: false,
    },
    plugins: [
      emailOTP({
        expiresIn: tokenLifetimeSeconds,
        allowedAttempts: 3,
        storeOTP: 'hashed',
        overrideDefaultEmailVerification: true,
        generateOTP: () => randomBytes(32).toString('base64url'),
        sendVerificationOTP: async ({ email: address, otp, type }) => {
          if (type !== 'email-verification') return;
          await email.send(
            emailFromTemplate(
              address,
              verificationTemplate(webOrigin, encodeVerificationToken(address, otp)),
            ),
          );
        },
      }),
    ],
    user: {
      modelName: 'users',
      fields: {
        name: 'auth_name',
        email: 'email_normalized',
        emailVerified: 'email_verified',
        image: 'auth_image',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
      additionalFields: {
        status: {
          type: 'string',
          required: true,
          input: false,
          defaultValue: 'pending_verification',
        },
        termsAcceptedAt: {
          type: 'date',
          required: true,
          input: false,
          returned: false,
          defaultValue: () => new Date(),
          fieldName: 'terms_accepted_at',
        },
        emailVerifiedAt: {
          type: 'date',
          required: false,
          input: false,
          returned: false,
          fieldName: 'email_verified_at',
        },
        deletionRequestedAt: {
          type: 'date',
          required: false,
          input: false,
          returned: false,
          fieldName: 'deletion_requested_at',
        },
      },
    },
    account: {
      modelName: 'auth_accounts',
      fields: {
        accountId: 'account_id',
        providerId: 'provider_id',
        userId: 'user_id',
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        idToken: 'id_token',
        accessTokenExpiresAt: 'access_token_expires_at',
        refreshTokenExpiresAt: 'refresh_token_expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    session: {
      modelName: 'auth_sessions',
      fields: {
        userId: 'user_id',
        expiresAt: 'expires_at',
        token: 'token_hash',
        ipAddress: 'ip_address',
        userAgent: 'user_agent',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
      cookieCache: { enabled: false },
    },
    verification: {
      modelName: 'auth_tokens',
      fields: {
        identifier: 'identifier_hash',
        value: 'token_value',
        expiresAt: 'expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
      storeIdentifier: 'hashed',
    },
    databaseHooks: {
      user: {
        create: {
          after: async (user) => {
            await sql`INSERT INTO user_roles (user_id, role) VALUES (${user.id}, 'user') ON CONFLICT DO NOTHING`.execute(
              db,
            );
            await sql`
              INSERT INTO professional_profiles (user_id, display_name, experience_level)
              VALUES (
                ${user.id},
                left(COALESCE(NULLIF(btrim(${user.name}), ''), 'Pessoa usuaria'), 120),
                'beginner'
              )
              ON CONFLICT DO NOTHING
            `.execute(db);
            if (autoVerifyEmail) {
              await sql`
                UPDATE users
                SET email_verified = true, status = 'active', email_verified_at = now(), updated_at = now()
                WHERE id = ${user.id}
              `.execute(db);
            }
          },
        },
        update: {
          before: async (user) =>
            user.emailVerified === true
              ? {
                  data: {
                    ...user,
                    status: 'active',
                    emailVerifiedAt: new Date(),
                  },
                }
              : { data: user },
        },
      },
      session: {
        create: {
          before: async (session) => {
            const result = await sql<{ status: string }>`
              SELECT status FROM users WHERE id = ${session.userId}
            `.execute(db);
            return result.rows[0]?.status === 'active' ? { data: session } : false;
          },
        },
      },
    },
    advanced: {
      // The canonical name already carries the stronger __Host- prefix.
      useSecureCookies: false,
      defaultCookieAttributes: {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
      },
      cookies: {
        session_token: {
          name: '__Host-skillmaps-session',
          attributes: {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
          },
        },
      },
      database: { generateId: 'uuid' },
    },
    telemetry: { enabled: false },
  } satisfies BetterAuthOptions;
}

export function createAuth(
  db: Kysely<FoundationDatabase>,
  secret: string,
  webOrigin: string,
  email: EmailPort,
  autoVerifyEmail = false,
) {
  return betterAuth(authOptions(db, secret, webOrigin, email, autoVerifyEmail));
}

export type SkillMapsAuth = ReturnType<typeof createAuth>;
