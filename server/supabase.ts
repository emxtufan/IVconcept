import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? '';
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';

const sharedOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
};

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}

export function hasSupabaseAdminAccess() {
  return Boolean(isSupabaseConfigured() && SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseConfigurationErrorMessage() {
  return 'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to your environment.';
}

export function getSupabaseAdminErrorMessage() {
  return 'Supabase admin access is not configured. Add SUPABASE_SERVICE_ROLE_KEY to enable admin writes and protected reads.';
}

export const supabasePublic = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, sharedOptions)
  : null;

export const supabaseAdmin = hasSupabaseAdminAccess()
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, sharedOptions)
  : null;
