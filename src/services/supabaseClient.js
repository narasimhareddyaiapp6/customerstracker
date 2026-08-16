// src/services/supabaseClient.js
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import SecureStoreAdapter from './SecureStoreAdapter';

// Access Supabase credentials from app.config.js with fallback defaults
const SUPABASE_URL =
  Constants.expoConfig?.extra?.SUPABASE_URL ||
  Constants.manifest?.extra?.SUPABASE_URL ||
  Constants.manifest2?.extra?.expoClient?.extra?.SUPABASE_URL ||
  'https://wtcxhhbigmqrmqdyhzcz.supabase.co';

const SUPABASE_ANON_KEY =
  Constants.expoConfig?.extra?.SUPABASE_ANON_KEY ||
  Constants.manifest?.extra?.SUPABASE_ANON_KEY ||
  Constants.manifest2?.extra?.expoClient?.extra?.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0Y3hoaGJpZ21xcm1xZHloemN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjE3ODgsImV4cCI6MjA2NzczNzc4OH0.AIViaiRT2odHJM2wQXl3dDZ69YxEj7t_7UiRFqEgZjY';

// Export the URL and Key for use in other parts of the app, like the TUS uploader.
export const supabaseUrl = SUPABASE_URL;
export const supabaseAnonKey = SUPABASE_ANON_KEY;

// Create and export the Supabase client directly.
// This client connects directly to your main Supabase project.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: SecureStoreAdapter, // Use our web-compatible SecureStore adapter
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
