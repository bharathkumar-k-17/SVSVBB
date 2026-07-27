import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─── Startup validation ───────────────────────────────────────────────────────
if (!supabaseUrl) {
  console.error('[Supabase] VITE_SUPABASE_URL is missing from .env');
}

if (!supabaseAnonKey) {
  console.error(
    '[Supabase] Missing Publishable Key'
  );
}

// ─── Database Types ───────────────────────────────────────────────────────────

export type UserRole = 'superadmin' | 'admin' | 'volunteer';
export type UserStatus = 'approved' | 'pending' | 'rejected';

export interface DbUser {
  id: string;
  email: string;
  name: string;
  username: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  photo_url: string;
  created_at: string;
  approved_at: string | null;
  approved_by: string | null;
  last_login: string | null;
}

export interface DbDevotee {
  id: string;
  name: string;
  phone: string;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  donation_item?: string;
  payment_mode: 'Cash' | 'UPI';
  payment_status: 'PAID' | 'PARTIAL' | 'UNPAID';
  gotram?: string;
  family_members?: string[];
  year: number;
  volunteer_id: string;
  volunteer_name: string;
  volunteer_phone?: string;
  created_at: number;
  receipt_no: string;
  trigger_reminder?: number;
}

export interface DbExpense {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: number;
  year: number;
  volunteer_id?: string;
  volunteer_name?: string;
  created_at?: number;
}

export interface DbCulturalEvent {
  id: string;
  game_name: string;
  category: string;
  winner1: string;
  winner2: string;
  year: number;
  added_by?: string;
  added_by_name?: string;
  created_at?: number;
  updated_at?: number;
}

export interface DbVipGotram {
  id: string;
  gotram: string;
  family_members: string[];
  order: number;
  source: 'Manual' | 'Chanda';
  devotee_id?: string;
  year: number;
  created_at?: number;
}

export interface DbSplRecord {
  id: string;
  description: string;
  amount: number;
  date: number;
  year: number;
  created_at?: number;
}

export interface DbPaymentHistory {
  id: string;
  devotee_id: string;
  amount: number;
  mode: 'Cash' | 'UPI';
  date: number;
  volunteer_id: string;
  volunteer_name?: string;
  transaction_id?: string | null;
  year?: number;
}

export interface DbSetting {
  id: string;
  upi_id?: string;
  festival_start_date?: string;
  [key: string]: any;
}

export interface DbCounter {
  id: string;
  count: number;
}

export interface DbNotification {
  id: string;
  type: string;
  message: string;
  amount?: number;
  created_at: number;
  created_by: string;
  created_by_name: string;
  audience_roles: string[];
  read_by?: string[];
}

export type Database = {
  public: {
    Tables: {
      users: {
        Row: DbUser;
        Insert: Omit<DbUser, 'created_at' | 'approved_at' | 'approved_by' | 'last_login'> & {
          created_at?: string;
          approved_at?: string | null;
          approved_by?: string | null;
          last_login?: string | null;
        };
        Update: Partial<DbUser>;
        Relationships: any[];
      };
      devotees: {
        Row: DbDevotee;
        Insert: Omit<DbDevotee, 'id'> & { id?: string };
        Update: Partial<DbDevotee>;
        Relationships: any[];
      };
      expenses: {
        Row: DbExpense;
        Insert: Omit<DbExpense, 'id'> & { id?: string };
        Update: Partial<DbExpense>;
        Relationships: any[];
      };
      cultural_events: {
        Row: DbCulturalEvent;
        Insert: Omit<DbCulturalEvent, 'id'> & { id?: string };
        Update: Partial<DbCulturalEvent>;
        Relationships: any[];
      };
      vip_gotrams: {
        Row: DbVipGotram;
        Insert: Omit<DbVipGotram, 'id'> & { id?: string };
        Update: Partial<DbVipGotram>;
        Relationships: any[];
      };
      spl_records: {
        Row: DbSplRecord;
        Insert: Omit<DbSplRecord, 'id'> & { id?: string };
        Update: Partial<DbSplRecord>;
        Relationships: any[];
      };
      payment_histories: {
        Row: DbPaymentHistory;
        Insert: Omit<DbPaymentHistory, 'id'> & { id?: string };
        Update: Partial<DbPaymentHistory>;
        Relationships: any[];
      };
      settings: {
        Row: DbSetting;
        Insert: DbSetting;
        Update: Partial<DbSetting>;
        Relationships: any[];
      };
      counters: {
        Row: DbCounter;
        Insert: DbCounter;
        Update: Partial<DbCounter>;
        Relationships: any[];
      };
      notifications: {
        Row: DbNotification;
        Insert: Omit<DbNotification, 'id'> & { id?: string };
        Update: Partial<DbNotification>;
        Relationships: any[];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      generate_receipt_no: {
        Args: { date_str: string };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// ─── Supabase Client ──────────────────────────────────────────────────────────

// Note: We intentionally omit the Database generic from createClient to avoid
// strict type resolution issues that cause 'never' inference on .insert()/.update().
// The DB interfaces above are used for documentation and manual casts where needed.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
