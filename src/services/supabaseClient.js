// src/services/supabaseClient.js

import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import SecureStoreAdapter from './SecureStoreAdapter';

const SUPABASE_URL =
  Constants.expoConfig?.extra?.SUPABASE_URL;

const SUPABASE_ANON_KEY =
  Constants.expoConfig?.extra?.SUPABASE_ANON_KEY;

// Validate configuration
if (!SUPABASE_URL) {
  throw new Error('SUPABASE_URL is not configured');
}

if (!SUPABASE_ANON_KEY) {
  throw new Error('SUPABASE_ANON_KEY is not configured');
}

// Export credentials for use elsewhere
export const supabaseUrl = SUPABASE_URL;
export const supabaseAnonKey = SUPABASE_ANON_KEY;

// Create Supabase client
export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: SecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
