import { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { signOut as firebaseSignOut } from 'firebase/auth';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import {
  LayoutDashboard, Users, HeartHandshake, Music, Receipt,
  Crown, BookOpen, Settings as SettingsIcon, LogOut, Menu, X,
  Wallet, User, KeyRound, ChevronDown, CreditCard, ShieldAlert,
  CalendarDays, Bell, CheckCheck
} from 'lucide-react';
import { auth } from '../lib/firebase';
import { InstallPrompt } from './InstallPrompt';
import { AppLock } from './AppLock';
import {
  AdminNotification,
  markNotificationRead,
  subscribeToAdminNotifications,
} from '../lib/notifications';

const BASE_NAV_ITEMS = [
  { path: '/dashboard',  label: 'Dashboard',          icon: LayoutDashboard },
  { path: '/devotees',   label: 'Devotees',            icon: Users           },
  { path: '/chanda',     label: 'Chanda Entry',        icon: HeartHandshake  },
  { path: '/cultural',   label: 'Cultural Activities', icon: Music           },
  { path: '/expenses',   label: 'Expenses & List',     icon: Receipt         },
  { path: '/payments',   label: 'Payment List',        icon: CreditCard      },
  { path: '/vip-gotram', label: 'VIP Gotram List',     icon: Crown           },
  { path: '/pooja-booking', label: 'Pooja Booking',      icon: CalendarDays    },
  { path: '/records',    label: 'Records',             icon: BookOpen        },
];

export function Layout() {
  const { appUser, signOut } = useAuthStore();
  const { currentYear, subscribeToDevotees, subscribeToExpenses, subscribeToCultural, subscribeToVIPGotrams, subscribeToSPLRecords } = useAppStore();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  const isAdmin = appUser?.role === 'admin' || appUser?.role === 'super_admin';
  const isVolunteer = appUser?.role === 'volunteer';

  const NAV_ITEMS = BASE_NAV_ITEMS.filter(item => {
    if (isVolunteer) {
      const allowed = ['/dashboard', '/chanda', '/expenses'];
      return allowed.includes(item.path);
    }
    return true;
  }).concat(isAdmin ? [{ path: '/spl-records', label: 'SPL Records', icon: ShieldAlert }] : [])
    .concat([{ path: '/settings',   label: 'Settings',            icon: SettingsIcon    }]);

  useEffect(() => {
    const u1 = subscribeToDevotees();
    const u2 = subscribeToExpenses();
    const u3 = subscribeToVIPGotrams();
    const u4 = subscribeToCultural();
    let u5: any = () => {};
    if (isAdmin) u5 = subscribeToSPLRecords();
    return () => { u1(); u2(); u3(); u4(); u5(); };
  }, [currentYear, isAdmin]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    return subscribeToAdminNotifications(appUser, setNotifications);
  }, [appUser?.uid, appUser?.role]);

  const handleLogout = async () => {
    await firebaseSignOut(auth);
    signOut();
    navigate('/login');
  };

  const initials = appUser?.name?.charAt(0)?.toUpperCase() ?? '?';
  const roleLabel = appUser?.role?.replace('_', ' ').toUpperCase() ?? '';
  const unreadNotifications = notifications.filter((notification) => !notification.readBy?.includes(appUser?.uid || ''));

  const markAllNotificationsRead = async () => {
    if (!appUser) return;
    await Promise.all(
      unreadNotifications.slice(0, 10).map((notification) => markNotificationRead(notification, appUser.uid)),
    );
  };

  return (
    <div className="flex h-screen bg-orange-50/60 relative overflow-hidden">

      {/* ── Ganesh Watermark ── */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        aria-hidden="true"
        style={{
          backgroundImage: 'url("/bg.png")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: 0.12,
        }}
      />

      {/* ══════════════════════════════
          LEFT SIDEBAR — Desktop
      ══════════════════════════════ */}
      <aside className="hidden flex-col w-64 bg-white shadow-xl z-20 border-r border-orange-100 flex-shrink-0">
        {/* Logo */}
        <div className="p-5 flex flex-col items-center justify-center border-b border-orange-100 bg-gradient-to-b from-orange-50 to-white">
          <img 
            src="/logo.jpg" 
            alt="SVBB Logo" 
            className="w-16 h-16 rounded-full shadow-lg mb-3 ring-4 ring-orange-100 object-cover bg-white"
          />
          <h1 className="text-xs font-bold text-gray-700 text-center leading-snug">
            Sree Vara Sidhi Vinayaka<br />
            <span className="text-orange-500">Baktha Bhrundam</span>
          </h1>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-orange-500 to-orange-400 text-white shadow-md shadow-orange-200'
                    : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                }`
              }
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Footer quote */}
        <div className="p-4 border-t border-orange-100 bg-orange-50/50">
          <p className="text-center text-xs font-bold text-orange-500 leading-relaxed">
            గణపతి బప్పా మోరయా!<br />
            <span className="text-gray-400 font-medium text-[10px]">✨ SPARKLING YOUTH ✨</span>
          </p>
        </div>
      </aside>

      {/* ══════════════════════════════
          MOBILE SIDEBAR OVERLAY
      ══════════════════════════════ */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-2xl flex flex-col z-10 animate-slide-in-left border-r border-white/50">
            <div className="p-5 flex flex-col items-center border-b border-orange-100 bg-gradient-to-br from-rose-50 via-purple-50 to-blue-50">
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-orange-100 text-orange-500 hover:bg-orange-200"
              >
                <X size={16} />
              </button>
              <img src="/logo.jpg" alt="Logo" className="w-12 h-12 rounded-full shadow-lg mb-2 object-cover bg-white" />
              <h1 className="text-xs font-bold text-gray-700 text-center">SVSVBB</h1>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-orange-500 via-pink-500 to-purple-500 text-white shadow-md'
                        : 'text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                    }`
                  }
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
            <div className="p-4 border-t border-orange-100">
              <p className="text-center text-xs font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-purple-500">✨ SPARKLING YOUTH ✨</p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════
          RIGHT PANEL
      ══════════════════════════════ */}
      <div className="flex flex-col flex-1 overflow-hidden z-10">

        {/* ── TOP BAR ── */}
        <header className="bg-white/90 backdrop-blur-md shadow-sm z-20 flex-shrink-0 border-b border-orange-100 sticky top-0">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6">

            {/* Left: Hamburger (mobile) */}
            <button
              className="p-2 rounded-xl text-gray-500 hover:bg-orange-50 hover:text-orange-500 transition-colors"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-6 w-6" />
            </button>

            {/* Center title (mobile) */}
            <div className="flex-1 flex justify-center md:justify-start md:ml-4 items-center">
              <span className="font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-purple-600 tracking-tight text-lg">SVSVBB</span>
            </div>

            {/* Desktop: page title area */}
            <div className="hidden md:flex items-center gap-2">
              <span className="text-sm text-gray-400 font-medium">
                శ్రీ వరసిద్ధి వినాయక భక్త బృందం
              </span>
            </div>

            {/* ── PROFILE DROPDOWN ── */}
            {isAdmin && (
              <div className="relative mr-2" ref={notificationRef}>
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative rounded-xl p-2.5 text-gray-500 transition-colors hover:bg-orange-50 hover:text-orange-600"
                  aria-label="Notifications"
                >
                  <Bell size={20} />
                  {unreadNotifications.length > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white">
                      {unreadNotifications.length}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-2xl">
                    <div className="flex items-center justify-between border-b border-orange-100 bg-orange-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-black text-gray-900">Notifications</p>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600">Admin Alerts</p>
                      </div>
                      {unreadNotifications.length > 0 && (
                        <button
                          type="button"
                          onClick={markAllNotificationsRead}
                          className="rounded-lg bg-white px-2 py-1 text-xs font-bold text-orange-700 shadow-sm hover:bg-orange-100"
                        >
                          <CheckCheck size={14} className="inline-block" /> Read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length > 0 ? (
                        notifications.map((notification) => {
                          const unread = !notification.readBy?.includes(appUser?.uid || '');
                          return (
                            <button
                              key={notification.id}
                              type="button"
                              onClick={() => appUser && markNotificationRead(notification, appUser.uid)}
                              className={`w-full border-b border-gray-100 px-4 py-3 text-left transition-colors hover:bg-orange-50 ${
                                unread ? 'bg-orange-50/60' : 'bg-white'
                              }`}
                            >
                              <p className="text-sm font-bold text-gray-900">{notification.message}</p>
                              <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                {new Date(notification.createdAt).toLocaleString()}
                              </p>
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-4 py-8 text-center text-sm font-bold text-gray-400">
                          No notifications yet.
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-orange-50 transition-colors group"
              >
                <div className="h-9 w-9 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 flex items-center justify-center text-white font-black shadow-md ring-2 ring-white overflow-hidden">
                  {appUser?.photoURL ? (
                    <img src={appUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="hidden sm:flex flex-col items-start leading-none">
                  <span className="text-sm font-semibold text-gray-900">{appUser?.name}</span>
                  <span className="text-[10px] text-orange-500 font-bold uppercase tracking-wider">{roleLabel}</span>
                </div>
                <ChevronDown
                  size={16}
                  className={`text-gray-400 transition-transform duration-200 ${profileOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {/* Dropdown Menu */}
              {profileOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-2xl border border-orange-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                  {/* User info header */}
                  <div className="px-4 py-3 bg-orange-50 border-b border-orange-100">
                    <p className="text-sm font-bold text-gray-800 truncate">{appUser?.name}</p>
                    <p className="text-xs text-gray-500 truncate">{appUser?.email}</p>
                  </div>

                  <div className="py-1">
                    <button
                      onClick={() => { navigate('/settings'); setProfileOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                    >
                      <User size={16} className="text-orange-400" />
                      My Profile
                    </button>

                    <button
                      onClick={() => { navigate('/settings'); setProfileOpen(false); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                    >
                      <KeyRound size={16} className="text-orange-400" />
                      Change Password
                    </button>

                    <div className="border-t border-gray-100 my-1" />

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors font-semibold"
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── MAIN CONTENT ── */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 scroll-smooth relative z-10">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>

        {/* ── FOOTER ── */}
        <footer className="bg-white/80 backdrop-blur-sm border-t border-orange-100 py-3 px-6 flex items-center justify-between z-10 flex-shrink-0 mb-16 md:mb-0">
          <p className="text-sm font-bold text-orange-600" style={{ fontFamily: "'Noto Sans Telugu', sans-serif" }}>
            🌸 గణపతి బప్పా మోరయా! మంగళ మూర్తి మోరయా! 🌸
          </p>
          <p className="text-sm font-black text-gray-500 tracking-widest">
            ✨ SPARKLING YOUTH ✨
          </p>
        </footer>
      </div>
      
      <InstallPrompt />
      <AppLock />
    </div>
  );
}
