import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from './AuthContext';
import type { AppUser, CulturalEvent, Devotee, Expense, FestivalSettings, Payment, VipEntry } from '../types';
import { getDefaultFestivalSettings, getMergedVipRows, nowIso } from '../lib/utils';

type FestivalContextType = {
  loading: boolean;
  settings: FestivalSettings;
  users: AppUser[];
  devotees: Devotee[];
  payments: Payment[];
  expenses: Expense[];
  culturalActivities: CulturalEvent[];
  vipEntries: VipEntry[];
  saveDevotee: (payload: Omit<Devotee, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<string>;
  deleteDevotee: (devoteeId: string) => Promise<void>;
  savePayment: (payload: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<string>;
  deletePayment: (paymentId: string) => Promise<void>;
  saveExpense: (payload: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<string>;
  deleteExpense: (expenseId: string) => Promise<void>;
  saveCulturalActivity: (payload: Omit<CulturalEvent, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<string>;
  deleteCulturalActivity: (activityId: string) => Promise<void>;
  saveVipEntry: (payload: Omit<VipEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<string>;
  deleteVipEntry: (entryId: string) => Promise<void>;
  moveVipEntry: (entryId: string, direction: 'up' | 'down') => Promise<void>;
  saveSettings: (payload: Partial<FestivalSettings>) => Promise<void>;
  uploadLogo: (file: File) => Promise<string>;
  updateUserStatus: (userId: string, status: AppUser['status']) => Promise<void>;
  updateUserRole: (userId: string, role: AppUser['role']) => Promise<void>;
};

const FestivalContext = createContext<FestivalContextType | null>(null);

export const FestivalProvider = ({ children }: { children: ReactNode }) => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<FestivalSettings>(getDefaultFestivalSettings());
  const [users, setUsers] = useState<AppUser[]>([]);
  const [devotees, setDevotees] = useState<Devotee[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [culturalActivities, setCulturalActivities] = useState<CulturalEvent[]>([]);
  const [vipEntries, setVipEntries] = useState<VipEntry[]>([]);

  useEffect(() => {
    if (!profile) {
      setLoading(false);
      return;
    }

    const unsubscribeSettings = onSnapshot(doc(db, 'appSettings', 'festival'), async (snapshot) => {
      if (!snapshot.exists()) {
        const defaults = getDefaultFestivalSettings();
        await setDoc(doc(db, 'appSettings', 'festival'), defaults);
        setSettings(defaults);
        return;
      }
      setSettings({ id: snapshot.id, ...(snapshot.data() as Omit<FestivalSettings, 'id'>) });
    });

    const unsubscribeUsers = onSnapshot(query(collection(db, 'users'), orderBy('createdAt', 'asc')), (snapshot) => {
      setUsers(snapshot.docs.map((entry) => ({ ...(entry.data() as AppUser), uid: entry.id })));
    });

    const unsubscribeDevotees = onSnapshot(query(collection(db, 'devotees'), orderBy('createdAt', 'desc')), (snapshot) => {
      setDevotees(snapshot.docs.map((entry) => ({ id: entry.id, ...(entry.data() as Omit<Devotee, 'id'>) })));
      setLoading(false);
    });

    const unsubscribePayments = onSnapshot(query(collection(db, 'payments'), orderBy('createdAt', 'desc')), (snapshot) => {
      setPayments(snapshot.docs.map((entry) => ({ id: entry.id, ...(entry.data() as Omit<Payment, 'id'>) })));
    });

    const unsubscribeExpenses = onSnapshot(query(collection(db, 'expenses'), orderBy('date', 'desc')), (snapshot) => {
      setExpenses(snapshot.docs.map((entry) => ({ id: entry.id, ...(entry.data() as Omit<Expense, 'id'>) })));
    });

    const unsubscribeCultural = onSnapshot(
      query(collection(db, 'culturalActivities'), orderBy('createdAt', 'desc')),
      (snapshot) => {
        setCulturalActivities(snapshot.docs.map((entry) => ({ id: entry.id, ...(entry.data() as Omit<CulturalEvent, 'id'>) })));
      },
    );

    const unsubscribeVip = onSnapshot(query(collection(db, 'vipEntries'), orderBy('order', 'asc')), (snapshot) => {
      setVipEntries(snapshot.docs.map((entry) => ({ id: entry.id, ...(entry.data() as Omit<VipEntry, 'id'>) })));
    });

    return () => {
      unsubscribeSettings();
      unsubscribeUsers();
      unsubscribeDevotees();
      unsubscribePayments();
      unsubscribeExpenses();
      unsubscribeCultural();
      unsubscribeVip();
    };
  }, [profile]);

  const saveDevotee = async (payload: Omit<Devotee, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    const timestamp = nowIso();
    if (payload.id) {
      const { id, ...rest } = payload;
      await updateDoc(doc(db, 'devotees', id), { ...rest, updatedAt: timestamp });
      return id;
    }

    const reference = await addDoc(collection(db, 'devotees'), {
      ...payload,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return reference.id;
  };

  const deleteDevotee = async (devoteeId: string) => {
    const relatedPayments = payments.filter((payment) => payment.devoteeId === devoteeId);
    await Promise.all([
      deleteDoc(doc(db, 'devotees', devoteeId)),
      ...relatedPayments.map((payment) => deleteDoc(doc(db, 'payments', payment.id))),
    ]);
  };

  const savePayment = async (payload: Omit<Payment, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    const timestamp = nowIso();
    if (payload.id) {
      const { id, ...rest } = payload;
      await updateDoc(doc(db, 'payments', id), { ...rest, updatedAt: timestamp });
      return id;
    }

    const reference = await addDoc(collection(db, 'payments'), {
      ...payload,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return reference.id;
  };

  const deletePayment = async (paymentId: string) => {
    await deleteDoc(doc(db, 'payments', paymentId));
  };

  const saveExpense = async (payload: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    const timestamp = nowIso();
    if (payload.id) {
      const { id, ...rest } = payload;
      await updateDoc(doc(db, 'expenses', id), { ...rest, updatedAt: timestamp });
      return id;
    }

    const reference = await addDoc(collection(db, 'expenses'), {
      ...payload,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return reference.id;
  };

  const deleteExpense = async (expenseId: string) => {
    await deleteDoc(doc(db, 'expenses', expenseId));
  };

  const saveCulturalActivity = async (
    payload: Omit<CulturalEvent, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  ) => {
    const timestamp = nowIso();
    if (payload.id) {
      const { id, ...rest } = payload;
      await updateDoc(doc(db, 'culturalActivities', id), { ...rest, updatedAt: timestamp });
      return id;
    }

    const reference = await addDoc(collection(db, 'culturalActivities'), {
      ...payload,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return reference.id;
  };

  const deleteCulturalActivity = async (activityId: string) => {
    await deleteDoc(doc(db, 'culturalActivities', activityId));
  };

  const saveVipEntry = async (payload: Omit<VipEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
    const timestamp = nowIso();
    if (payload.id) {
      const { id, ...rest } = payload;
      await updateDoc(doc(db, 'vipEntries', id), { ...rest, updatedAt: timestamp });
      return id;
    }

    const reference = await addDoc(collection(db, 'vipEntries'), {
      ...payload,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    return reference.id;
  };

  const deleteVipEntry = async (entryId: string) => {
    await deleteDoc(doc(db, 'vipEntries', entryId));
  };

  const moveVipEntry = async (entryId: string, direction: 'up' | 'down') => {
    const manualEntries = [...vipEntries].sort((a, b) => a.order - b.order);
    const index = manualEntries.findIndex((entry) => entry.id === entryId);
    if (index === -1) return;
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= manualEntries.length) return;

    const current = manualEntries[index];
    const target = manualEntries[swapIndex];

    await Promise.all([
      updateDoc(doc(db, 'vipEntries', current.id), { order: target.order, updatedAt: nowIso() }),
      updateDoc(doc(db, 'vipEntries', target.id), { order: current.order, updatedAt: nowIso() }),
    ]);
  };

  const saveSettings = async (payload: Partial<FestivalSettings>) => {
    const nextSettings = { ...settings, ...payload, updatedAt: nowIso() };
    await setDoc(doc(db, 'appSettings', 'festival'), nextSettings, { merge: true });
  };

  const uploadLogo = async (file: File) => {
    const storageRef = ref(storage, `festival-assets/logo-${Date.now()}-${file.name}`);
    await uploadBytes(storageRef, file);
    const logoUrl = await getDownloadURL(storageRef);
    await saveSettings({ logoUrl });
    return logoUrl;
  };

  const updateUserStatus = async (userId: string, status: AppUser['status']) => {
    await setDoc(doc(db, 'users', userId), { status }, { merge: true });
  };

  const updateUserRole = async (userId: string, role: AppUser['role']) => {
    await setDoc(doc(db, 'users', userId), { role }, { merge: true });
  };

  const value = useMemo<FestivalContextType>(
    () => ({
      loading,
      settings,
      users,
      devotees,
      payments,
      expenses,
      culturalActivities,
      vipEntries,
      saveDevotee,
      deleteDevotee,
      savePayment,
      deletePayment,
      saveExpense,
      deleteExpense,
      saveCulturalActivity,
      deleteCulturalActivity,
      saveVipEntry,
      deleteVipEntry,
      moveVipEntry,
      saveSettings,
      uploadLogo,
      updateUserStatus,
      updateUserRole,
    }),
    [loading, settings, users, devotees, payments, expenses, culturalActivities, vipEntries],
  );

  return <FestivalContext.Provider value={value}>{children}</FestivalContext.Provider>;
};

export const useFestival = () => {
  const context = useContext(FestivalContext);
  if (!context) {
    throw new Error('useFestival must be used within FestivalProvider');
  }
  return context;
};

export const useVipRows = () => {
  const { vipEntries, devotees, payments } = useFestival();
  return useMemo(() => getMergedVipRows(vipEntries, devotees, payments), [vipEntries, devotees, payments]);
};
