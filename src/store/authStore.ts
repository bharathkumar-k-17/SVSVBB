import { create } from 'zustand';
import { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export type UserRole = 'super_admin' | 'admin' | 'volunteer';
export type UserStatus = 'approved' | 'pending' | 'rejected';

export interface AppUser {
  uid: string;
  email: string;
  username?: string;
  name: string;
  phone: string;
  photoURL?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: number;
}

const normalizeRole = (role: unknown): UserRole => {
  if (role === 'super_admin' || role === 'SUPER_ADMIN') return 'super_admin';
  if (role === 'admin' || role === 'ADMIN') return 'admin';
  return 'volunteer';
};

const normalizeStatus = (status: unknown): UserStatus => {
  if (status === 'approved' || status === 'pending' || status === 'rejected') return status;
  return 'pending';
};

interface AuthState {
  user: User | null;
  appUser: AppUser | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  fetchAppUser: (uid: string) => Promise<void>;
  setLoading: (loading: boolean) => void;
  signOut: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  appUser: null,
  loading: true,
  setUser: (user) => set({ user }),
  fetchAppUser: async (uid) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        set({
          appUser: {
            uid: data.uid || uid,
            email: data.email || '',
            username: data.username || '',
            name: data.name || '',
            phone: data.phone || '',
            photoURL: data.photoURL || '',
            role: normalizeRole(data.role),
            status: normalizeStatus(data.status),
            createdAt: data.createdAt || data.created_at || Date.now(),
          },
        });
      } else {
        set({ appUser: null });
      }
    } catch (error) {
      console.error("Error fetching app user:", error);
      set({ appUser: null });
    }
  },
  setLoading: (loading) => set({ loading }),
  signOut: () => set({ user: null, appUser: null }),
}));
