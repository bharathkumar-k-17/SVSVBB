import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, limit, query, setDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { auth, db, storage } from '../lib/firebase';
import type { AppUser, Role, UserRole } from '../types';
import { nowIso } from '../lib/utils';

type SignUpPayload = {
  name: string;
  email: string;
  phone: string;
  password: string;
};

type AuthContextType = {
  firebaseUser: FirebaseUser | null;
  profile: AppUser | null;
  role: Role | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (payload: SignUpPayload) => Promise<string>;
  logout: () => Promise<void>;
  refreshProfile: (userOverride?: FirebaseUser | null) => Promise<AppUser | null>;
  updateAccountProfile: (payload: { name: string; phone: string }) => Promise<void>;
  changeAccountPassword: (newPassword: string) => Promise<void>;
  uploadProfilePhoto: (file: File) => Promise<string>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const mapRole = (role?: UserRole): Role | null => {
  if (role === 'super_admin') return 'SUPER_ADMIN';
  if (role === 'admin') return 'ADMIN';
  if (role === 'volunteer') return 'VOLUNTEER';
  return null;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = async (userOverride?: FirebaseUser | null) => {
    const targetUser = userOverride ?? auth.currentUser;
    if (!targetUser) {
      setProfile(null);
      return null;
    }

    const userRef = doc(db, 'users', targetUser.uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      await signOut(auth);
      setProfile(null);
      setError('Account profile not found. Please contact an administrator.');
      return null;
    }

    const data = userDoc.data() as Partial<AppUser>;
    const resolvedProfile: AppUser = {
      uid: targetUser.uid,
      email: data.email || targetUser.email || '',
      name: data.name || targetUser.displayName || '',
      phone: data.phone || '',
      role: data.role || 'volunteer',
      status: data.status || 'pending',
      createdAt: data.createdAt || nowIso(),
      photoURL: data.photoURL || targetUser.photoURL || '',
    };

    if (resolvedProfile.status !== 'approved') {
      await signOut(auth);
      setFirebaseUser(null);
      setProfile(null);
      setError(
        resolvedProfile.status === 'pending'
          ? 'Your account is pending admin approval.'
          : 'Your account has been rejected. Please contact an administrator.',
      );
      return null;
    }

    setError(null);
    setProfile(resolvedProfile);
    return resolvedProfile;
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        await refreshProfile(user);
      } catch (authError) {
        console.error(authError);
        setError('Unable to load your account right now.');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    setError(null);
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const loadedProfile = await refreshProfile(credential.user);
    if (!loadedProfile) {
      throw new Error('Approval required');
    }
  };

  const signup = async ({ name, email, phone, password }: SignUpPayload) => {
    setError(null);
    const existingUsers = await getDocs(query(collection(db, 'users'), limit(1)));
    const isFirstUser = existingUsers.empty;
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(credential.user, { displayName: name });

    const role: UserRole = isFirstUser ? 'super_admin' : 'volunteer';
    const status = isFirstUser ? 'approved' : 'pending';

    const userProfile: AppUser = {
      uid: credential.user.uid,
      email,
      name,
      phone,
      role,
      status,
      createdAt: nowIso(),
      photoURL: '',
    };

    await setDoc(doc(db, 'users', credential.user.uid), userProfile);
    await signOut(auth);

    return isFirstUser
      ? 'Bootstrap complete. Your first account was created as Super Admin.'
      : 'Signup submitted. Wait for admin approval before logging in.';
  };

  const logout = async () => {
    await signOut(auth);
    setProfile(null);
    setFirebaseUser(null);
  };

  const updateAccountProfile = async ({ name, phone }: { name: string; phone: string }) => {
    if (!auth.currentUser || !profile) return;
    await updateProfile(auth.currentUser, { displayName: name });
    const nextProfile = { ...profile, name, phone, photoURL: auth.currentUser.photoURL || profile.photoURL || '' };
    await setDoc(doc(db, 'users', auth.currentUser.uid), nextProfile, { merge: true });
    setProfile(nextProfile);
  };

  const changeAccountPassword = async (newPassword: string) => {
    if (!auth.currentUser) return;
    await updatePassword(auth.currentUser, newPassword);
  };

  const uploadProfilePhoto = async (file: File) => {
    if (!auth.currentUser || !profile) return '';
    const storageRef = ref(storage, `profile-photos/${auth.currentUser.uid}-${Date.now()}-${file.name}`);
    await uploadBytes(storageRef, file);
    const photoURL = await getDownloadURL(storageRef);
    await updateProfile(auth.currentUser, { photoURL });
    const nextProfile = { ...profile, photoURL };
    await setDoc(doc(db, 'users', auth.currentUser.uid), nextProfile, { merge: true });
    setProfile(nextProfile);
    return photoURL;
  };

  const value = useMemo<AuthContextType>(
    () => ({
      firebaseUser,
      profile,
      role: mapRole(profile?.role),
      loading,
      error,
      login,
      signup,
      logout,
      refreshProfile,
      updateAccountProfile,
      changeAccountPassword,
      uploadProfilePhoto,
    }),
    [firebaseUser, profile, loading, error],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
