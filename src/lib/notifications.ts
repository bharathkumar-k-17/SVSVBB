import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore';
import { db } from './firebase';
import type { AppUser } from '../store/authStore';

export type AdminNotificationType = 'chanda' | 'expense' | 'pooja';

export interface AdminNotification {
  id: string;
  type: AdminNotificationType;
  message: string;
  amount?: number;
  createdAt: number;
  createdBy: string;
  createdByName: string;
  audienceRoles: Array<'admin' | 'super_admin'>;
  readBy?: string[];
}

const currency = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

export const createAdminNotification = async ({
  actor,
  type,
  amount,
}: {
  actor: AppUser | null;
  type: AdminNotificationType;
  amount: number;
}) => {
  if (!actor || actor.role !== 'volunteer') return;

  const label =
    type === 'chanda'
      ? `New Chanda added ${currency(amount)} by ${actor.name || 'Volunteer'}`
      : type === 'expense'
        ? `New Expense added ${currency(amount)} by ${actor.name || 'Volunteer'}`
        : `New Pooja booking updated by ${actor.name || 'Volunteer'}`;

  await addDoc(collection(db, 'notifications'), {
    type,
    message: label,
    amount,
    createdAt: Date.now(),
    createdBy: actor.uid,
    createdByName: actor.name || 'Volunteer',
    audienceRoles: ['admin', 'super_admin'],
    readBy: [],
  });
};

export const subscribeToAdminNotifications = (
  appUser: AppUser | null | undefined,
  callback: (notifications: AdminNotification[]) => void,
) => {
  if (!appUser || (appUser.role !== 'admin' && appUser.role !== 'super_admin')) {
    callback([]);
    return () => {};
  }

  const notificationsQuery = query(
    collection(db, 'notifications'),
    orderBy('createdAt', 'desc'),
    limit(25),
  );

  return onSnapshot(notificationsQuery, (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as AdminNotification));
  });
};

export const markNotificationRead = async (notification: AdminNotification, uid: string) => {
  if (notification.readBy?.includes(uid)) return;
  await updateDoc(doc(db, 'notifications', notification.id), {
    readBy: [...(notification.readBy || []), uid],
  });
};
