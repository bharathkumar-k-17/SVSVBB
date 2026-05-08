export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'VOLUNTEER';
export type UserRole = 'super_admin' | 'admin' | 'volunteer';
export type UserStatus = 'approved' | 'pending' | 'rejected';
export type PaymentMode = 'Cash' | 'UPI';
export type PaymentStatus = 'success' | 'pending' | 'rejected';
export type DevoteeCollectionStatus = 'Paid' | 'Partial' | 'Unpaid';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  phone?: string;
  createdAt: string;
}

export interface AppUser {
  uid: string;
  email: string;
  name: string;
  phone: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  photoURL?: string;
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
