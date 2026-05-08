import type { AppUser } from '../types';

export const isAdmin = (role?: AppUser['role']) => role === 'admin' || role === 'super_admin';
export const isSuperAdmin = (role?: AppUser['role']) => role === 'super_admin';

export const canManageExpenses = (role?: AppUser['role']) => isAdmin(role);
export const canManageCultural = (role?: AppUser['role']) => isAdmin(role);
export const canApprovePayments = (role?: AppUser['role']) => isAdmin(role);
export const canDeleteRecords = (role?: AppUser['role']) => isAdmin(role);
export const canManageVipManualEntries = (role?: AppUser['role']) => isAdmin(role);
