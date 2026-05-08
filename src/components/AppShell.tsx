import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  CreditCard,
  HandCoins,
  LayoutDashboard,
  LogOut,
  Menu,
  NotebookPen,
  NotebookText,
  Shield,
  Settings,
  Sparkles,
  Theater,
  Users,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import { useFestival } from '../contexts/FestivalContext';
import { canManageCultural, canManageExpenses } from '../lib/permissions';
import { Card, Button, Badge } from './ui';
import { toRoleLabel } from '../lib/utils';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/devotees', label: 'Devotees', icon: Users },
  { to: '/chanda', label: 'Chanda Entry', icon: HandCoins },
  { to: '/cultural', label: 'Cultural Activities', icon: Theater, adminOnly: true },
  { to: '/expenses', label: 'Expenses & List', icon: NotebookPen, adminOnly: true },
  { to: '/payments', label: 'Payment List', icon: CreditCard },
  { to: '/vip-gothram', label: 'VIP Gothram', icon: Sparkles },
  { to: '/records', label: 'Records', icon: NotebookText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export const AppShell = ({ children }: { children: ReactNode }) => {
  const { profile, logout } = useAuth();
  const { settings } = useFestival();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const visibleNavItems = useMemo(
    () =>
      navItems.filter((item) => {
        if (item.adminOnly && !canManageExpenses(profile?.role) && !canManageCultural(profile?.role)) {
          return false;
        }
        return true;
      }),
    [profile?.role],
  );

  const sidebar = (
    <div className="flex h-full flex-col rounded-[2rem] border border-orange-100 bg-white/90 p-5 shadow-[0_24px_50px_-30px_rgba(154,52,18,0.5)] backdrop-blur">
      <div className="flex items-center gap-4">
        {settings.logoUrl ? (
          <img src={settings.logoUrl} alt={settings.appName} className="h-14 w-14 rounded-2xl border border-orange-100 object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 font-serif text-2xl font-bold text-white">
            శ్రీ
          </div>
        )}
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-orange-600">Festival Portal</p>
          <h1 className="font-serif text-lg font-semibold text-stone-900">{settings.appName}</h1>
        </div>
      </div>

      <div className="mt-6 rounded-3xl bg-gradient-to-br from-orange-500 to-amber-400 p-4 text-white">
        <p className="text-xs uppercase tracking-[0.24em] text-orange-100">Active Year</p>
        <p className="mt-2 font-serif text-3xl font-semibold">{settings.festivalYear}</p>
        <p className="mt-1 text-sm text-orange-50">Role-based management for devotees, collections, VIP lists, and reports.</p>
      </div>

      <nav className="mt-6 flex-1 space-y-2">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition',
                  isActive ? 'bg-stone-900 text-white shadow-lg shadow-stone-300' : 'text-stone-600 hover:bg-orange-50 hover:text-orange-700',
                )
              }
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <Card className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-stone-900">{profile?.name}</p>
            <p className="text-xs text-stone-500">{profile?.email}</p>
          </div>
          <Badge tone={profile?.role === 'volunteer' ? 'warning' : 'success'}>{toRoleLabel(profile?.role || 'volunteer')}</Badge>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.28),_transparent_38%),linear-gradient(180deg,_#fff7ed,_#fffbf5_42%,_#fff)]">
      <div className="mx-auto grid min-h-screen max-w-[1600px] gap-6 px-4 py-4 lg:grid-cols-[320px_1fr] lg:px-6 lg:py-6">
        <div className="hidden lg:block">{sidebar}</div>

        {menuOpen ? (
          <div className="fixed inset-0 z-40 bg-stone-950/40 p-4 lg:hidden">
            <div className="h-full max-w-sm">{sidebar}</div>
          </div>
        ) : null}

        <div className="relative flex min-w-0 flex-col gap-6 overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-24 z-0 flex justify-center opacity-[0.08]">
            <div className="select-none font-serif text-[16rem] font-bold tracking-[0.4em] text-orange-700 blur-[1px]">गणेश</div>
          </div>
          <header className="flex flex-wrap items-center justify-between gap-4 rounded-[2rem] border border-orange-100 bg-white/90 px-5 py-4 shadow-[0_24px_50px_-32px_rgba(154,52,18,0.4)] backdrop-blur">
            <div className="flex items-center gap-3">
              <Button type="button" tone="ghost" className="lg:hidden" onClick={() => setMenuOpen((value) => !value)}>
                <Menu className="h-4 w-4" />
              </Button>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-orange-600">Current section</p>
                <h2 className="font-serif text-2xl font-semibold text-stone-900">
                  {visibleNavItems.find((item) => item.to === location.pathname)?.label || 'Festival Workspace'}
                </h2>
              </div>
            </div>

            <div className="relative flex items-center gap-3">
              <Card className="px-4 py-3">
                <p className="text-sm font-semibold text-stone-900">{profile?.name}</p>
                <p className="text-xs text-stone-500">{toRoleLabel(profile?.role || 'volunteer')}</p>
              </Card>
              <Button type="button" tone="secondary" onClick={() => setProfileOpen((value) => !value)}>
                <Shield className="mr-2 h-4 w-4" />
                Profile
              </Button>

              {profileOpen ? (
                <div className="absolute right-0 top-[calc(100%+12px)] z-20 w-56 rounded-3xl border border-orange-100 bg-white p-3 shadow-[0_20px_45px_-24px_rgba(120,53,15,0.45)]">
                  <button className="flex w-full items-center rounded-2xl px-4 py-3 text-left text-sm font-medium text-stone-700 transition hover:bg-orange-50">
                    My Profile
                  </button>
                  <button className="flex w-full items-center rounded-2xl px-4 py-3 text-left text-sm font-medium text-stone-700 transition hover:bg-orange-50">
                    Change Password
                  </button>
                  <button
                    className="flex w-full items-center rounded-2xl px-4 py-3 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                    onClick={logout}
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          </header>

          <main className="relative z-10 min-w-0 pb-4">{children}</main>

          <footer className="relative z-10 rounded-[2rem] border border-orange-100 bg-white/90 px-6 py-5 shadow-[0_24px_50px_-32px_rgba(154,52,18,0.4)] backdrop-blur">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="font-serif text-lg text-stone-700">"Where devotion gathers, Lord Ganesha clears every path."</p>
              <p className="text-sm font-semibold uppercase tracking-[0.32em] text-orange-600">Sparkling Youth</p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
};
