import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

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

// ─── Map snake_case DB rows → camelCase app types ─────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapDevotee = (row: any): Devotee => ({
  id: row.id,
  name: row.name ?? '',
  phone: row.phone ?? '',
  totalAmount: row.total_amount ?? 0,
  paidAmount: row.paid_amount ?? 0,
  pendingAmount: row.pending_amount ?? 0,
  donationItem: row.donation_item,
  paymentMode: row.payment_mode ?? 'Cash',
  paymentStatus: row.payment_status ?? 'UNPAID',
  gotram: row.gotram,
  familyMembers: row.family_members ?? [],
  year: row.year ?? new Date().getFullYear(),
  volunteerId: row.volunteer_id ?? '',
  volunteerName: row.volunteer_name ?? '',
  createdAt: row.created_at ?? Date.now(),
  receiptNo: row.receipt_no ?? '',
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapExpense = (row: any): Expense => ({
  id: row.id,
  description: row.description ?? '',
  amount: row.amount ?? 0,
  category: row.category ?? '',
  date: row.date ?? Date.now(),
  year: row.year ?? new Date().getFullYear(),
  volunteerId: row.volunteer_id,
  volunteerName: row.volunteer_name,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapCultural = (row: any): CulturalEvent => ({
  id: row.id,
  gameName: row.game_name ?? '',
  category: row.category ?? '',
  winner1: row.winner1 ?? '',
  winner2: row.winner2 ?? '',
  year: row.year ?? new Date().getFullYear(),
  addedBy: row.added_by,
  addedByName: row.added_by_name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapVipGotram = (row: any): VIPGotram => ({
  id: row.id,
  gotram: row.gotram ?? '',
  familyMembers: row.family_members ?? [],
  order: row.order ?? 0,
  source: row.source ?? 'Manual',
  devoteeId: row.devotee_id,
  year: row.year ?? new Date().getFullYear(),
  createdAt: row.created_at,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapSplRecord = (row: any): SPLRecord => ({
  id: row.id,
  description: row.description ?? '',
  amount: row.amount ?? 0,
  date: row.date ?? Date.now(),
  year: row.year ?? new Date().getFullYear(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mapPaymentHistory = (row: any): PaymentHistory => ({
  id: row.id,
  devoteeId: row.devotee_id ?? '',
  amount: row.amount ?? 0,
  mode: row.mode ?? 'Cash',
  date: row.date ?? Date.now(),
  volunteerId: row.volunteer_id ?? '',
});

// ─── Store ────────────────────────────────────────────────────────────────────

interface AppState {
  currentYear: number;
  loading: boolean;
  setYear: (year: number) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentYear: new Date().getFullYear(),
  loading: false,

  setYear: (year) =>
    set({
      currentYear: year,
    }),
}));
