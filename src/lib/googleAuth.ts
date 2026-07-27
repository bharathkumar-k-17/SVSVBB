/**
 * Google Auth Utility
 * 
 * Handles Google OAuth flow with Supabase, including:
 * - Initiating Google sign-in
 * - Auto-creating profile for new Google users
 * - Checking approval status for returning users
 */

import { supabase } from './supabase';
import type { UserRole } from './supabase';

/**
 * Initiate Google OAuth sign-in flow.
 * This redirects the user to Google's consent screen.
 * After successful auth, Supabase redirects back to the app.
 */
export async function signInWithGoogle(redirectTo?: string) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTo || `${window.location.origin}/login`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });
  if (error) throw new Error(error.message);
}

/**
 * Handle the callback after Google OAuth.
 * Creates a profile row if the user doesn't exist.
 * Returns the profile status for routing decisions.
 */
export async function handleGoogleUserProfile(userId: string, userMetadata: Record<string, any>, userEmail: string) {
  // Check if profile exists
  const { data: existing } = await supabase
    .from('users')
    .select('id, email, status, role')
    .eq('id', userId)
    .single() as { data: { email: string; status: string; role: string } | null; error: any };

  if (existing) {
    // Returning user
    return {
      isNew: false,
      status: existing.status as string,
      role: existing.role as string,
    };
  }

  // New Google user — determine role
  const { count } = await supabase
    .from('users')
    .select('email', { count: 'exact', head: true });

  const isFirstUser = count === 0;
  const assignedRole: UserRole = isFirstUser ? 'superadmin' : 'volunteer';
  const assignedStatus = isFirstUser ? 'approved' : 'pending';

  // Auto-generate username from email
  const emailPrefix = userEmail.split('@')[0] || 'user';
  let username = emailPrefix.toLowerCase().replace(/[^a-z0-9_]/g, '');
  
  // Ensure uniqueness
  const { data: existingUsername } = await supabase
    .from('users')
    .select('username')
    .eq('username', username)
    .limit(1);
  
  if (existingUsername && existingUsername.length > 0) {
    username = `${username}_${Date.now().toString(36)}`;
  }

  // Create profile
  const { error: insertError } = await supabase.from('users').insert({
    id: userId,
    email: userEmail,
    name: userMetadata.full_name || userMetadata.name || 'Google User',
    username,
    phone: '',
    role: assignedRole,
    status: assignedStatus,
    photo_url: userMetadata.avatar_url || userMetadata.picture || '',
    created_at: new Date().toISOString(),
  });

  if (insertError) throw new Error(insertError.message);

  return {
    isNew: true,
    status: assignedStatus,
    role: assignedRole,
  };
}

/**
 * Check if a user's email is already associated with an account.
 */
export async function checkEmailExists(email: string): Promise<boolean> {
  const { data } = await supabase
    .from('users')
    .select('email')
    .eq('email', email.trim().toLowerCase())
    .limit(1);
  return !!data && data.length > 0;
}
