import { createHmac } from 'node:crypto';
import type express from 'express';
import { supabaseAdmin } from './supabase.js';

interface RateLimitResult { allowed: boolean; retry_after: number }
type RateLimitConsumer = (scope: string, identity: string, limit: number, windowSeconds: number, globalLimit: number) => Promise<RateLimitResult>;

async function consumeStoredRateLimit(scope: string, identity: string, limit: number, windowSeconds: number, globalLimit: number) {
  if (!supabaseAdmin) throw new Error('Supabase admin access is required for distributed request limits.');
  const { data, error } = await supabaseAdmin.rpc('consume_rate_limit', {
    p_scope: scope, p_identity: identity, p_limit: limit, p_window_seconds: windowSeconds, p_global_limit: globalLimit,
  });
  if (error) throw new Error(`Distributed request limit unavailable: ${error.message}`);
  const result = Array.isArray(data) ? data[0] : data;
  if (!result || typeof result.allowed !== 'boolean' || !Number.isFinite(result.retry_after)) throw new Error('Invalid rate limit response.');
  return result as RateLimitResult;
}

export function createRateLimitMiddleware(
  scope: string,
  options: { limit: number; windowSeconds: number; globalLimit: number },
  consume: RateLimitConsumer = consumeStoredRateLimit,
): express.RequestHandler {
  return async (request, response, next) => {
    try {
      const secret = process.env.ADMIN_SESSION_SECRET?.trim() || process.env.ADMIN_PASSWORD?.trim();
      if (!secret) throw new Error('ADMIN_SESSION_SECRET is required for request limits.');
      // request.ip trusts a reverse proxy only when index.ts explicitly configures it.
      const identity = createHmac('sha256', secret).update(request.ip || request.socket.remoteAddress || 'unknown').digest('hex');
      const result = await consume(scope, identity, options.limit, options.windowSeconds, options.globalLimit);
      if (!result.allowed) {
        response.setHeader('Retry-After', String(Math.max(1, result.retry_after)));
        response.status(429).json({ message: 'Prea multe încercări. Te rugăm să revii puțin mai târziu.' });
        return;
      }
      next();
    } catch (error) {
      console.error('Request protection unavailable:', error instanceof Error ? error.message : 'Unknown error');
      console.error('Check Supabase configuration and apply supabase/backend_security_migration.sql.');
      response.status(503).json({ message: 'Serviciul este temporar indisponibil. Te rugăm să încerci din nou puțin mai târziu.' });
    }
  };
}
