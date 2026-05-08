import { create } from 'zustand';
import { collection, onSnapshot, query, where, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Devotee {
  id: string;
  name: string;
  phone: string;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  donationItem?: string;
  paymentMode: 'Cash' | 'UPI';
  paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID';
  gotram?: string;
  familyMembers?: string[];
  year: number;
  volunteerId: string;
  volunteerName: string;
  createdAt: number;
  receiptNo: string;
}

export interface PaymentHistory {
  id: string;
  devoteeId: string;
  amount: number;
  mode: 'Cash' | 'UPI';
  date: number;
  volunteerId: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: number;
  year: number;
  volunteerId?: string;
  volunteerName?: string;
}

export interface CulturalEvent {
  id: string;
  gameName: string;
  category: string;
  winner1: string;
  winner2: string;
  year: number;
  addedBy?: string;
  addedByName?: string;
  createdAt?: number;
  updatedAt?: number;
}

export interface VIPGotram {
  id: string;
  gotram: string;
  familyMembers: string[];
  order: number;
  source: 'Manual' | 'Chanda';
  devoteeId?: string;
  year: number;
  createdAt?: number;
}

export interface SPLRecord {
  id: string;
  description: string;
  amount: number;
  date: number;
  year: number;
}

interface AppState {
  currentYear: number;
  devotees: Devotee[];
  expenses: Expense[];
  culturalEvents: CulturalEvent[];
  vipGotrams: VIPGotram[];
  splRecords: SPLRecord[];
  paymentHistories: Record<string, PaymentHistory[]>;
  loading: boolean;
  initialized: {
    devotees: boolean;
    expenses: boolean;
    cultural: boolean;
    vipGotrams: boolean;
    splRecords: boolean;
  };
  setYear: (year: number) => void;
  // Subscribers
  subscribeToDevotees: () => () => void;
  subscribeToExpenses: () => () => void;
  subscribeToCultural: () => () => void;
  subscribeToVIPGotrams: () => () => void;
  subscribeToSPLRecords: () => () => void;
  subscribeToPaymentHistory: (devoteeId: string) => () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentYear: new Date().getFullYear(),
  devotees: [],
  expenses: [],
  culturalEvents: [],
  vipGotrams: [],
  splRecords: [],
  paymentHistories: {},
  loading: false,
  initialized: {
    devotees: false,
    expenses: false,
    cultural: false,
    vipGotrams: false,
    splRecords: false,
  },
  setYear: (year) => set({ 
    currentYear: year,
    initialized: {
      devotees: false,
      expenses: false,
      cultural: false,
      vipGotrams: false,
      splRecords: false,
    }
  }),

  subscribeToDevotees: () => {
    const q = query(collection(db, 'devotees'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const year = get().currentYear;
      const devs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Devotee))
        .filter(d => d.year === year);
      set((state) => ({ devotees: devs, initialized: { ...state.initialized, devotees: true } }));
    });
  },

  subscribeToExpenses: () => {
    const q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const year = get().currentYear;
      const exp = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Expense))
        .filter(e => e.year === year);
      set((state) => ({ expenses: exp, initialized: { ...state.initialized, expenses: true } }));
    });
  },

  subscribeToCultural: () => {
    const q = query(collection(db, 'culturalEvents'));
    return onSnapshot(q, (snapshot) => {
      const year = get().currentYear;
      const events = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as CulturalEvent))
        .filter(e => e.year === year);
      set((state) => ({ culturalEvents: events, initialized: { ...state.initialized, cultural: true } }));
    });
  },

  subscribeToVIPGotrams: () => {
    const q = query(collection(db, 'vipGotrams'));
    return onSnapshot(q, (snapshot) => {
      const year = get().currentYear;
      const gotrams = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as VIPGotram))
        .filter(g => g.year === year)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      set((state) => ({ vipGotrams: gotrams, initialized: { ...state.initialized, vipGotrams: true } }));
    });
  },

  subscribeToSPLRecords: () => {
    const q = query(collection(db, 'spl_records'), orderBy('date', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const year = get().currentYear;
      const records = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as SPLRecord))
        .filter(r => r.year === year);
      set((state) => ({ splRecords: records, initialized: { ...state.initialized, splRecords: true } }));
    });
  },

  subscribeToPaymentHistory: (devoteeId: string) => {
    const q = query(collection(db, 'payments'), where('devoteeId', '==', devoteeId));
    return onSnapshot(q, (snapshot) => {
      // Sort manually locally to avoid missing index
      const history = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as PaymentHistory))
        .sort((a, b) => b.date - a.date);
      set((state) => ({
        paymentHistories: {
          ...state.paymentHistories,
          [devoteeId]: history
        }
      }));
    });
  }
}));
