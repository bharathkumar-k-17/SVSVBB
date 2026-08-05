import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type UserRole = 'superadmin' | 'admin' | 'volunteer';
export type UserStatus = 'approved' | 'pending' | 'rejected';

export interface AppUser {
  id: string;
  email: string;
  username?: string;
  name: string;
  phone: string;
  photoURL?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  approvedAt?: string | null;
  approvedBy?: string | null;
  lastLogin?: string | null;
}

const normalizeRole = (role: unknown): UserRole => {
  if (role === 'superadmin' || role === 'super_admin' || role === 'SUPER_ADMIN') return 'superadmin';
  if (role === 'admin' || role === 'ADMIN') return 'admin';
  return 'volunteer';
};

const normalizeStatus = (status: unknown): UserStatus => {
  if (status === 'approved' || status === 'pending' || status === 'rejected') return status;
  return 'pending';
};

interface AuthState {
  // Supabase session/user
  session: Session | null;
  supabaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;

  setSession: (session: Session | null) => void;
  fetchAppUser: (userId: string) => Promise<void>;
  setLoading: (loading: boolean) => void;
  setAppUser: (user: AppUser | null) => void;
  signOut: () => Promise<void>;
  updateLastLogin: (userId: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  supabaseUser: null,
  appUser: null,
  loading: true,

  setSession: (session) =>
    set({
      session,
      supabaseUser: session?.user ?? null,
    }),

  fetchAppUser: async (userId: string) => {
    const currentState = get();
    if (currentState.appUser?.id === userId) {
      return; // Prevent duplicate fetches
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, username, name, phone, photo_url, role, status, created_at, approved_at, approved_by, last_login')
        .eq('id', userId)
        .maybeSingle() as { data: Record<string, any> | null; error: any };

      if (error || !data) {
        set({ appUser: null });
        return;
      }

      set({
        appUser: {
          id: data.id ?? '',
          email: data.email ?? '',
          username: data.username ?? '',
          name: data.name ?? '',
          phone: data.phone ?? '',
          photoURL: data.photo_url ?? '',
          role: normalizeRole(data.role),
          status: normalizeStatus(data.status),
          createdAt: data.created_at ?? new Date().toISOString(),
          approvedAt: data.approved_at ?? null,
          approvedBy: data.approved_by ?? null,
          lastLogin: data.last_login ?? null,
        },
      });
    } catch (error) {
      console.error('[AuthStore] Error fetching app user:', error);
      set({ appUser: null });
    }
  },

  setLoading: (loading) => set({ loading }),

  setAppUser: (user) => set({ appUser: user }),

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, supabaseUser: null, appUser: null });
    window.location.replace('/login');
  },

  updateLastLogin: async (userId: string) => {
    try {
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', userId);
    } catch (e) {
      console.error('[AuthStore] Error updating last_login:', e);
    }
  },
}));
