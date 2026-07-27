import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { AppUser } from '../store/authStore';

export type AdminNotificationType = string;

export interface AdminNotification {
  id: string;
  type: string;
  message: string;
  amount?: number;
  created_at: number;
  created_by: string;
  created_by_name: string;
  audience_roles: Array<'admin' | 'superadmin'>;
  read_by?: string[];
}

export const createAdminNotification = async ({
  actor,
  actorName,
  type,
  message,
}: {
  actor?: AppUser | null;
  actorName?: string;
  type: string;
  message: string;
}) => {
  // If the action is initiated by a superadmin or admin from the management portal (not QR), don't notify unless required.
  // But wait, the requirements say "When a VOLUNTEER performs these actions... notify ADMIN + SUPERADMIN."
  // And "QR Portal ... notify ADMIN + SUPERADMIN".
  // Let's not strict block on actor role here, instead rely on callers to pass actor correctly or just allow it.
  // But let's keep it safe. If actor is an admin/superadmin, the caller can decide to not call this, or we can filter it.
  // Actually, we'll just insert whatever the caller tells us to.
  
  const created_by = actor?.email || 'system';
  const created_by_name = actor?.name || actorName || 'System';

  try {
    await supabase.from('notifications').insert({
      type,
      message,
      created_at: Date.now(),
      created_by,
      created_by_name,
      audience_roles: ['admin', 'superadmin'],
      read_by: [],
    });
  } catch (err) {
    console.warn('[Notifications] Failed to create notification:', err);
  }
};

export const subscribeToAdminNotifications = (
  appUser: AppUser | null | undefined,
  callback: (notifications: AdminNotification[]) => void,
) => {
  if (!appUser || (appUser.role !== 'admin' && appUser.role !== 'superadmin')) {
    callback([]);
    return () => {};
  }

  // Initial fetch
  supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(25)
    .then(({ data }) => {
      callback((data as AdminNotification[]) ?? []);
    });

  // Realtime subscription
  const channel: RealtimeChannel = supabase
    .channel('admin-notifications')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications' },
      () => {
        supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(25)
          .then(({ data }) => {
            callback((data as AdminNotification[]) ?? []);
          });
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const markNotificationRead = async (notification: AdminNotification, email: string) => {
  if (notification.read_by?.includes(email)) return;
  try {
    await supabase
      .from('notifications')
      .update({
        read_by: [...(notification.read_by || []), email],
      })
      .eq('id', notification.id);
  } catch (err) {
    console.warn('[Notifications] Failed to mark as read:', err);
  }
};

export const markAllNotificationsRead = async (notifications: AdminNotification[], email: string) => {
  const unreadNotifications = notifications.filter(n => !n.read_by?.includes(email));
  if (unreadNotifications.length === 0) return;

  try {
    await Promise.all(
      unreadNotifications.map(notification =>
        supabase
          .from('notifications')
          .update({
            read_by: [...(notification.read_by || []), email],
          })
          .eq('id', notification.id)
      )
    );
  } catch (err) {
    console.warn('[Notifications] Failed to mark all as read:', err);
  }
};

export const subscribeToUnreadCount = (
  appUser: AppUser | null | undefined,
  callback: (count: number) => void,
) => {
  if (!appUser || (appUser.role !== 'admin' && appUser.role !== 'superadmin')) {
    callback(0);
    return () => {};
  }

  const fetchCount = async () => {
    // We fetch all notifications that this user is allowed to see (by role)
    // and where their email is NOT in the read_by array.
    // For simplicity, we just fetch them and count locally if RLS handles audience_roles, 
    // or we can use the contains filter. Since audience_roles is an array:
    const { data, error } = await supabase
      .from('notifications')
      .select('id, read_by')
      .contains('audience_roles', [appUser.role]);

    if (!error && data) {
      const unreadCount = data.filter(n => !n.read_by?.includes(appUser.email)).length;
      callback(unreadCount);
    }
  };

  fetchCount();

  const channel: RealtimeChannel = supabase
    .channel('admin-notifications-count')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications' },
      () => {
        fetchCount();
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
