import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useNotifications } from '../hooks/queries';
import { AdminNotification, markNotificationRead, markAllNotificationsRead } from '../lib/notifications';
import { Bell, CheckCheck, ChevronLeft, ChevronRight, Inbox, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';
import { isToday, isYesterday, isThisYear, format } from 'date-fns';

function formatNotificationDate(dateString: string) {
  const date = new Date(dateString);
  if (isToday(date)) {
    return format(date, 'h:mm a');
  } else if (isYesterday(date)) {
    return 'Yesterday';
  } else if (isThisYear(date)) {
    return format(date, 'd MMM');
  } else {
    return format(date, 'd MMM yyyy');
  }
}

export function Notifications() {
  const { appUser } = useAuthStore();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [localReadIds, setLocalReadIds] = useState<Set<string>>(new Set());
  const pageSize = 50;

  // We maintain a local cache for realtime inserts so they appear at the top
  const [realtimeNotifications, setRealtimeNotifications] = useState<AdminNotification[]>([]);

  const { data: notificationsData, isLoading, refetch } = useNotifications(
    appUser?.role,
    appUser?.email,
    undefined, // fetch ALL notifications
    page,
    pageSize
  );

  useEffect(() => {
    if (!appUser) return;
    
    // Subscribe to realtime inserts
    const channel = supabase
      .channel('notifications-page')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const newNotif = payload.new as AdminNotification;
          if ((newNotif.audience_roles as string[])?.includes(appUser.role)) {
            setRealtimeNotifications((prev) => [newNotif, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [appUser]);

  const allNotifications = useMemo(() => {
    // combine realtime and fetched, avoiding duplicates
    const fetched = notificationsData?.data || [];
    const realtimeIds = new Set(realtimeNotifications.map(n => n.id));
    const uniqueFetched = fetched.filter(n => !realtimeIds.has(n.id));
    return [...realtimeNotifications, ...uniqueFetched];
  }, [realtimeNotifications, notificationsData?.data]);

  const filteredNotifications = useMemo(() => {
    if (!searchTerm.trim()) return allNotifications;
    const lower = searchTerm.toLowerCase();
    return allNotifications.filter(n => 
      n.type.toLowerCase().includes(lower) ||
      n.message.toLowerCase().includes(lower) ||
      (n.actorName && n.actorName.toLowerCase().includes(lower))
    );
  }, [allNotifications, searchTerm]);
    
  const totalCount = (notificationsData?.count || 0) + realtimeNotifications.length;
  const totalPages = Math.ceil(totalCount / pageSize);

  const unreadCount = useMemo(() => {
    return allNotifications.filter(n => 
      !n.read_by?.includes(appUser?.email || '') && !localReadIds.has(n.id)
    ).length;
  }, [allNotifications, appUser?.email, localReadIds]);

  const handleNotificationClick = async (notif: AdminNotification) => {
    const isUnread = appUser && (!notif.read_by?.includes(appUser.email) && !localReadIds.has(notif.id));
    
    if (isUnread) {
      setLocalReadIds(prev => new Set(prev).add(notif.id));
      await markNotificationRead(notif, appUser.email);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!appUser) return;
    try {
      // Get all unread for this user
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .contains('audience_roles', [appUser.role])
        .not('read_by', 'cs', `{${appUser.email}}`)
        .limit(500);

      if (data && data.length > 0) {
        const newLocalRead = new Set(localReadIds);
        data.forEach(n => newLocalRead.add(n.id));
        setLocalReadIds(newLocalRead);
        
        await markAllNotificationsRead(data as AdminNotification[], appUser.email);
        toast.success('Marked all as read');
        refetch();
      }
    } catch (err) {
      toast.error('Failed to mark all as read');
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-orange-50 p-3 rounded-full flex-shrink-0">
            <Bell className="text-orange-600 h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Notifications</h1>
            {unreadCount > 0 ? (
              <p className="text-sm font-medium text-orange-600 mt-1">
                {unreadCount} unread
              </p>
            ) : (
              <p className="text-sm font-medium text-gray-400 mt-1">
                All caught up
              </p>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllAsRead}
            className="flex items-center gap-2 px-4 py-2 bg-white text-orange-600 border border-orange-200 rounded-xl hover:bg-orange-50 hover:border-orange-300 transition-all text-sm font-bold shadow-sm whitespace-nowrap"
          >
            <CheckCheck size={18} />
            Mark all as read
          </button>
        )}
      </div>

      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search notifications..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-10 pr-3 py-3 border border-orange-200 rounded-2xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all shadow-sm"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
        <div className="divide-y divide-gray-100 min-h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-[400px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600"></div>
            </div>
          ) : filteredNotifications.length > 0 ? (
            filteredNotifications.map((notification) => {
              const isUnread = !notification.read_by?.includes(appUser?.email || '') && !localReadIds.has(notification.id);
              
              return (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full text-left px-4 py-3 sm:py-4 transition-colors hover:bg-gray-50 flex items-center gap-3 ${
                    isUnread ? 'bg-orange-50/20' : 'bg-white'
                  }`}
                >
                  <div className="flex-shrink-0 w-3 h-3 flex items-center justify-center">
                    {isUnread && (
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center md:gap-3">
                    <p className={`text-[10px] sm:text-xs font-bold uppercase tracking-widest whitespace-nowrap md:w-56 flex-shrink-0 ${
                      isUnread ? 'text-blue-600' : 'text-gray-500'
                    }`}>
                      {notification.type}
                    </p>
                    <p className={`text-sm sm:text-base truncate flex-1 ${
                      isUnread ? 'font-bold text-gray-900' : 'font-medium text-gray-700'
                    }`}>
                      {notification.message}
                    </p>
                  </div>

                  <div className="flex-shrink-0 ml-2">
                    <p className={`text-xs whitespace-nowrap ${isUnread ? 'font-bold text-blue-600' : 'text-gray-400'}`}>
                      {formatNotificationDate(notification.created_at)}
                    </p>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-[400px] text-gray-400">
              <Inbox size={48} className="mb-4 opacity-20" />
              <p className="font-bold text-lg">
                No notifications found.
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && !searchTerm && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-orange-100 bg-gray-50">
            <span className="text-sm font-semibold text-gray-500">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
