export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'VOLUNTEER';
export type UserRole = 'superadmin' | 'admin' | 'volunteer';
export type UserStatus = 'approved' | 'pending' | 'rejected';
export type PaymentMode = 'Cash' | 'UPI';
export type PaymentStatus = 'success' | 'pending' | 'rejected';
export type DevoteeCollectionStatus = 'Paid' | 'Partial' | 'Unpaid';

export interface User {
  id: string;
  email: string;
  name: string;
  username: string;
  phone?: string;
  role: Role;
  status: UserStatus;
  photo_url?: string;
  created_at: string;
  approved_at?: string;
  approved_by?: string;
  last_login?: string;
}

export interface AppUser {
  id: string;
  email: string;
  name: string;
  username: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  photo_url?: string;
  created_at: string;
  approved_at?: string;
  approved_by?: string;
  last_login?: string;
}

export interface FestivalYear {
  id: string;
  isActive: boolean;
  isLocked: boolean;
  nextReceiptNumber: number;
  createdAt: string;
}

export interface Devotee {
  id: string;
  name: string;
  phone: string;
  phoneNumber?: string;
  totalAmount: number;
  amountPledged?: number;
  paymentMode?: PaymentMode;
  gotram?: string;
  familyMembers?: string;
  familyNames?: string;
  notes?: string;
  addedBy: string;
  addedByName: string;
  year: number;
  receiptNo: string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  devoteeId: string;
  devoteeName: string;
  devoteePhone: string;
  amount: number;
  mode: PaymentMode;
  transactionId?: string;
  status: PaymentStatus;
  remarks?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
  date: string;
  addedBy: string;
  addedByName: string;
  year: number;
}

export interface Expense {
  id: string;
  item: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  addedBy: string;
  addedByName: string;
  year: number;
  createdAt: string;
  updatedAt: string;
}

export interface CulturalEvent {
  id: string;
  game: string;
  name?: string;
  category: string;
  winners: string;
  winner1?: string;
  winner2?: string;
  participants?: string[];
  addedBy: string;
  addedByName: string;
  year: number;
  createdAt: string;
  updatedAt: string;
}

export interface VipEntry {
  id: string;
  gotram: string;
  members: string;
  order: number;
  source: 'Manual' | 'Chanda';
  devoteeId?: string;
  year: number;
  createdAt: string;
  updatedAt: string;
}

export interface FestivalSettings {
  id: string;
  appName: string;
  festivalYear: number;
  upiId: string;
  logoUrl?: string;
  system_access?: boolean;
  updatedAt: string;
}

export interface DevoteeSummary extends Devotee {
  paidAmount: number;
  pendingAmount: number;
  status: DevoteeCollectionStatus;
  isVip: boolean;
}

export interface VipListRow {
  id: string;
  gotram: string;
  members: string;
  source: 'Manual' | 'Chanda';
  order: number;
  devoteeId?: string;
}

export interface LadduAuction {
  id: string;
  yearId: string;
  bidderName: string;
  amount: number;
  createdAt: string;
}

export interface HundiCollection {
  id: string;
  yearId: string;
  amountCounted: number;
  date: string;
  countedBy: string;
  createdAt: string;
}

export interface AnnadanamItem {
  id: string;
  yearId: string;
  itemName: string;
  quantity: string;
  cost: number;
  assignedVolunteer: string;
  createdAt: string;
}

export interface QRPortalSettings {
  id: string;
  portal_name: string;
  committee_name: string;
  festival_year: number;
  temple_image_url?: string;
  banner_image_url?: string;
  welcome_message?: string;
  footer_quote?: string;
  address?: string;
  google_maps_url?: string;
  phone_number?: string;
  whatsapp_number?: string;
  email?: string;
  facebook_url?: string;
  instagram_url?: string;
  youtube_url?: string;
  website_url?: string;
  enable_chanda: boolean;
  enable_receipt: boolean;
  enable_pooja: boolean;
  enable_feedback: boolean;
  updated_at: string;
}

export type FeedbackQuestionType = 'Rating' | 'Text' | 'Yes/No' | 'Multiple Choice';

export interface FeedbackQuestion {
  id: string;
  question: string;
  type: FeedbackQuestionType;
  options: string[];
  order: number;
  is_active: boolean;
  created_at: string;
}

export interface PublicChandaRequest {
  id: string;
  name: string;
  phone: string;
  total_amount: number;
  donation_item?: string;
  payment_mode?: PaymentMode;
  transaction_id?: string;
  reference_number?: string;
  gotram?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: number;
  updated_at: string;
}

export interface AppSettings {
  id: string;
  system_access: boolean;
  upi_id?: string;
  festival_start_date?: string;
  logo_url?: string;
  chanda_confirmation_template?: string;
  chanda_pending_template?: string;
  pooja_confirmation_template?: string;
  pooja_reminder_template?: string;
  festival_greeting_template?: string;
}
