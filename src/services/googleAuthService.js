import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { Platform } from 'react-native';
import { supabase } from './supabaseClient';

// Ensure browser session cleans up properly
WebBrowser.maybeCompleteAuthSession();

/**
 * Ensures that the signed-in user has an entry in the public.users table.
 */
export async function ensureUserProfileExists(user) {
  if (!user || !user.id) return null;
  try {
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (existingUser) {
      return existingUser;
    }

    const fullName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'Google User';

    const avatarUrl =
      user.user_metadata?.avatar_url ||
      user.user_metadata?.picture ||
      null;

    const newUserProfile = {
      id: user.id,
      email: user.email,
      name: fullName,
      user_type: 'user',
      location_status: 0,
      profile_photo_data: avatarUrl,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('users')
      .insert(newUserProfile)
      .select()
      .single();

    if (insertError) {
      console.warn('Could not insert profile into users table:', insertError);
    }
    return inserted || newUserProfile;
  } catch (err) {
    console.error('Error in ensureUserProfileExists:', err);
    return null;
  }
}

/**
 * Initiates Google OAuth Sign-in for both Mobile and Web platforms.
 */
export async function signInWithGoogleOAuth() {
  try {
    if (Platform.OS === 'web') {
      const redirectUrl = typeof window !== 'undefined' ? window.location.origin : '';
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error) throw error;
      return { type: 'redirect', data };
    }

    // Native Mobile (Android / iOS)
    const redirectUri = makeRedirectUri({
      scheme: 'customerstracker',
      path: 'auth/callback',
    });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUri,
        skipBrowserRedirect: true,
        queryParams: {
          access_type: 'offline',
          prompt: 'select_account',
        },
      },
    });

    if (error) throw error;

    if (!data?.url) {
      throw new Error('Google authentication URL was not received from Supabase.');
    }

    const authResult = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

    let authUrl = null;

    if (authResult.type === 'success' && authResult.url) {
      authUrl = authResult.url;
    } else {
      // On some Android devices, the Custom Tab dismisses when the deep link activates.
      // Check if session was already established or wait briefly
      const { data: currentSession } = await supabase.auth.getSession();
      if (currentSession?.session) {
        await ensureUserProfileExists(currentSession.session.user);
        return { type: 'success', session: currentSession.session };
      }
      if (authResult.type === 'cancel') {
        return { type: 'cancelled' };
      }
    }

    if (authUrl) {
      const params = {};
      const [baseAndQuery, hash] = authUrl.split('#');
      const query = baseAndQuery.split('?')[1];
      if (query) {
        query.split('&').forEach((part) => {
          const [k, v] = part.split('=');
          if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v);
        });
      }
      if (hash) {
        hash.split('&').forEach((part) => {
          const [k, v] = part.split('=');
          if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v);
        });
      }

      if (params.error) {
        throw new Error(params.error_description || params.error);
      }

      let session = null;

      // Check for access_token / refresh_token (Implicit Flow)
      if (params.access_token && params.refresh_token) {
        const { data: sessionData, error: sessionErr } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });
        if (sessionErr) throw sessionErr;
        session = sessionData?.session;
      } else if (params.code) {
        // Check for code (PKCE Flow)
        const { data: sessionData, error: sessionErr } = await supabase.auth.exchangeCodeForSession(params.code);
        if (sessionErr) throw sessionErr;
        session = sessionData?.session;
      } else {
        // Check if session was already picked up
        const { data: currentSession } = await supabase.auth.getSession();
        session = currentSession?.session;
      }

      if (!session) {
        throw new Error('Could not establish user session from Google authentication response.');
      }

      await ensureUserProfileExists(session.user);
      return { type: 'success', session };
    }

    throw new Error('Google Sign-in process did not complete.');
  } catch (err) {
    console.error('Error during Google Sign-in:', err);
    throw err;
  }
}
