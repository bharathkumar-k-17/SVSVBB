
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { format } from 'date-fns';
import {
  CreditCard, Wallet, Users, TrendingUp,
  HeartHandshake, Receipt, Crown, ArrowRight,
  IndianRupee, TrendingDown, CalendarCheck2, HandCoins
} from 'lucide-react';
import { maskPhoneNumber } from '../lib/privacy';

export function Dashboard() {
  const {
    currentYear, devotees, expenses, vipGotrams,
    setYear, initialized
  } = useAppStore();
  const { appUser } = useAuthStore();
  const navigate = useNavigate();

  const totalCollected = devotees.reduce((s, d) => s + (d.paidAmount || 0), 0);
  const totalPending   = devotees.reduce((s, d) => s + (d.pendingAmount || 0), 0);
  const totalExpenses  = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const netBalance     = totalCollected - totalExpenses;
  const vipCount       = vipGotrams.length;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'శుభోదయం 🌅';
    if (h < 17) return 'శుభ మధ్యాహ్నం ☀️';
    return 'శుభ సాయంత్రం 🌙';
  };

  const isVolunteer = appUser?.role === 'volunteer';
  const myTodayCollection = devotees
    .filter(d => 
      d.volunteerId === appUser?.uid && 
      new Date(d.createdAt).toDateString() === new Date().toDateString()
    )
    .reduce((s, d) => s + (d.paidAmount || 0), 0);

  const todayCollection = devotees
    .filter(d => new Date(d.createdAt).toDateString() === new Date().toDateString())
    .reduce((s, d) => s + (d.paidAmount || 0), 0);

  const actionCards = [
    {
      id: 'chanda',
      label: 'Chanda Entry',
      path: '/chanda',
      image: '/Chandaentry.jpeg',
      stats: [
        { text: `${isVolunteer ? devotees.filter(d => d.volunteerId === appUser?.uid && new Date(d.createdAt).toDateString() === new Date().toDateString()).length : devotees.length} entries`, classes: 'text-purple-700 bg-purple-50 border-purple-100' },
        { text: `₹${(isVolunteer ? myTodayCollection : totalCollected).toLocaleString()} collected`, classes: 'text-pink-700 bg-pink-50 border-pink-100' },
      ],
      show: true,
    },
    {
      id: 'expenses',
      label: 'Expenses & List',
      path: '/expenses',
      image: '/Expenses list.jpeg',
      stats: [
        { text: `${expenses.length} records`, classes: 'text-rose-700 bg-rose-50 border-rose-100' },
        { text: `₹${totalExpenses.toLocaleString()} spent`, classes: 'text-orange-700 bg-orange-50 border-orange-100' },
      ],
      show: true,
    },
    {
      id: 'pooja',
      label: 'Pooja Booking',
      path: '/pooja-booking',
      image: '/Pooja Booking.jpeg',
      stats: [
        { text: 'Manual dates', classes: 'text-amber-700 bg-amber-50 border-amber-100' },
        { text: 'Reminders', classes: 'text-orange-700 bg-orange-50 border-orange-100' },
      ],
      show: !isVolunteer,
    },
    {
      id: 'vip',
      label: 'VIP Gotram',
      path: '/vip-gotram',
      image: '/Vip Gothram list.jpeg',
      stats: [
        { text: `${vipCount} VIP entries`, classes: 'text-yellow-700 bg-yellow-50 border-yellow-100' },
      ],
      show: !isVolunteer,
    },
    {
      id: 'devotees',
      label: 'Devotees',
      path: '/devotees',
      image: '/Devotees.jpeg',
      stats: [
        { text: `${devotees.length} registered`, classes: 'text-indigo-700 bg-indigo-50 border-indigo-100' },
      ],
      show: !isVolunteer,
    },
    {
      id: 'cultural',
      label: 'Cultural Activities',
      path: '/cultural',
      image: '/Cultural Activities.jpeg',
      stats: [
        { text: 'Manage activities', classes: 'text-blue-700 bg-blue-50 border-blue-100' },
      ],
      show: !isVolunteer,
    },
    {
      id: 'records',
      label: 'Records',
      path: '/records',
      image: '/records.jpeg',
      icon: CreditCard,
      stats: [
        { text: 'View all records', classes: 'text-emerald-700 bg-emerald-50 border-emerald-100' },
      ],
      show: !isVolunteer,
    }
  ];

  return (
    <div className="space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 relative z-10 w-full bg-gradient-to-r from-rose-100 via-purple-100 to-blue-100 p-5 rounded-3xl border border-white/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <div>
          <p className="text-xs font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-500 mb-0.5">{greeting()}</p>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight drop-shadow-sm">
            Welcome, {appUser?.name?.split(' ')?.[0] || 'User'} ✨
          </h1>
          <p className="text-gray-700 mt-1 text-xs font-medium">
            {isVolunteer ? 'Volunteer Dashboard' : 'Dashboard overview'} for{' '}
            <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-pink-500">{currentYear}</span> festival
          </p>
        </div>

        {/* Year selector (Only for Admins) */}
        {!isVolunteer && (
          <div className="flex items-center gap-2 bg-white/50 backdrop-blur-md border border-white/60 rounded-xl px-3 py-1.5 shadow-md ring-1 ring-black/5">
            <span className="text-xs text-gray-800 font-bold">Festival Year:</span>
            <select
              value={currentYear}
              onChange={(e) => setYear(Number(e.target.value))}
              className="text-xs font-black text-transparent bg-clip-text bg-gradient-to-br from-purple-600 to-orange-600 focus:outline-none cursor-pointer bg-transparent"
            >
              {[...Array(5)].map((_, i) => {
                const yr = new Date().getFullYear() - i;
                return <option key={yr} value={yr} className="text-black">{yr}</option>;
              })}
            </select>
          </div>
        )}
      </div>

      {/* ── STAT CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 relative z-10 w-full">

        {/* Volunteer specific stats */}
        {isVolunteer ? (
          <>
            {/* My Collection Today */}
            <div className="bg-gradient-to-br from-purple-600 to-pink-600 rounded-2xl p-5 shadow-xl border border-white/20 hover:-translate-y-0.5 transition-all group relative overflow-hidden col-span-2">
              <div className="absolute -right-8 -top-8 w-24 h-24 bg-white/20 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
              <div className="relative z-10">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-[10px] font-extrabold text-white/90 uppercase tracking-widest">My Collection Today</p>
                  <div className="bg-white/20 backdrop-blur-md p-1.5 rounded-lg border border-white/30">
                    <TrendingUp className="h-4 w-4 text-white" />
                  </div>
                </div>
                <p className="text-3xl font-black text-white drop-shadow-md">
                  ₹{myTodayCollection.toLocaleString()}
                </p>
                <p className="text-[10px] text-white/90 font-bold mt-1 tracking-wide">
                  From {devotees.filter(d => d.volunteerId === appUser?.uid && new Date(d.createdAt).toDateString() === new Date().toDateString()).length} entries
                </p>
              </div>
            </div>

            {/* Total Today (Global) */}
            <div className="hidden">
              <div className="absolute -right-8 -top-8 w-24 h-24 bg-gradient-to-br from-emerald-400/40 to-cyan-400/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
              <div className="relative z-10 flex flex-col justify-center h-full">
                <p className="text-[10px] font-extrabold text-gray-700 uppercase tracking-widest mb-1"></p>
                <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-br from-emerald-600 to-cyan-600">
                  ₹{todayCollection.toLocaleString()}
                </p>
                <p className="text-[10px] text-gray-500 font-bold mt-1 tracking-wide">All volunteers combined ✨</p>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Total Collected (Admin only) */}
            <div className="bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 rounded-3xl p-5 shadow-lg shadow-emerald-500/30 border border-white/20 hover:-translate-y-1 transition-all group relative overflow-hidden">
              <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-white/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
              <div className="relative z-10">
                <div className="flex justify-between items-center mb-3">
                  <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl border border-white/30 group-hover:bg-white/30 transition-colors">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-[10px] font-black text-white/90 uppercase tracking-widest bg-white/20 px-2 py-1 rounded-full border border-white/20">Collected</span>
                </div>
                <p className="text-2xl font-black text-white tracking-tight drop-shadow-md">
                  {initialized.devotees ? `₹${totalCollected.toLocaleString()}` : '...'}
                </p>
                <p className="text-xs text-emerald-50 font-medium mt-1">Total Chanda Paid</p>
              </div>
            </div>

            {/* Total Pending */}
            <div className="bg-gradient-to-br from-rose-400 via-orange-500 to-amber-500 rounded-3xl p-5 shadow-lg shadow-orange-500/30 border border-white/20 hover:-translate-y-1 transition-all group relative overflow-hidden">
              <div className="absolute right-0 top-0 w-full h-full bg-white/5 mix-blend-overlay" />
              <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-white/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
              <div className="relative z-10">
                <div className="flex justify-between items-center mb-3">
                  <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl border border-white/30 group-hover:bg-white/30 transition-shadow">
                    <Wallet className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-[10px] font-black text-white/90 uppercase tracking-widest bg-white/20 px-2 py-1 rounded-full border border-white/20">Pending</span>
                </div>
                <p className="text-2xl font-black text-white tracking-tight drop-shadow-md">
                  {initialized.devotees ? `₹${totalPending.toLocaleString()}` : '...'}
                </p>
                <p className="text-xs text-orange-50 font-bold mt-1">Awaiting Payment</p>
              </div>
            </div>

            {/* Total Devotees */}
            <div className="bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-3xl p-5 shadow-lg shadow-indigo-500/30 border border-white/20 hover:-translate-y-1 transition-all group relative overflow-hidden">
              <div className="absolute inset-0 bg-white/5 mix-blend-overlay" />
              <div className="absolute -left-10 -top-10 w-32 h-32 bg-white/20 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700" />
              <div className="relative z-10">
                <div className="flex justify-between items-center mb-3">
                  <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl border border-white/30 group-hover:bg-white/30">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-[10px] font-black text-white/90 uppercase tracking-widest bg-white/20 border border-white/30 px-2 py-1 rounded-full">Devotees</span>
                </div>
                <p className="text-2xl font-black text-white tracking-tight drop-shadow-sm">
                  {initialized.devotees ? devotees.length : '...'}
                </p>
                <p className="text-xs text-indigo-100 font-medium mt-1">Registered</p>
              </div>
            </div>

            {/* Today Collection (Glassmorphism + Mesh Gradients) */}
            <div className="bg-white/10 backdrop-blur-2xl rounded-3xl p-5 shadow-[0_8px_32px_0_rgba(31,38,135,0.15)] border border-white/40 hover:-translate-y-1 transition-all group relative overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/40 before:to-transparent before:pointer-events-none">
              <div className="absolute -right-20 -top-20 w-48 h-48 bg-gradient-to-br from-fuchsia-400 via-purple-400 to-indigo-500 rounded-full blur-[40px] opacity-40 group-hover:opacity-60 group-hover:scale-110 transition-all duration-700 pointer-events-none" />
              <div className="absolute -left-20 -bottom-20 w-48 h-48 bg-gradient-to-tr from-cyan-400 via-teal-300 to-emerald-400 rounded-full blur-[40px] opacity-40 group-hover:opacity-60 group-hover:scale-110 transition-all duration-700 pointer-events-none" />
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/5 opacity-50 mix-blend-overlay pointer-events-none" />
              <div className="relative z-10">
                <div className="flex justify-between items-center mb-3">
                  <div className="bg-white/30 backdrop-blur-xl p-2 rounded-xl shadow-[inset_0_1px_3px_rgba(255,255,255,0.6)] border border-white/50">
                    <HandCoins className="h-5 w-5 text-gray-900 drop-shadow-md" />
                  </div>
                  <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest bg-white/30 backdrop-blur-xl px-2 py-1 rounded-full border border-white/50 shadow-sm">Today</span>
                </div>
                <p className="text-2xl font-black text-gray-900 tracking-tight drop-shadow-sm">
                  {initialized.devotees ? `₹${todayCollection.toLocaleString()}` : '...'}
                </p>
                <p className="text-xs text-gray-700 font-bold mt-1 tracking-wide">Collected Today</p>
              </div>
            </div>

          </>
        )}
      </div>

      {/* ── DASHBOARD MODULES ── */}
      <div className="relative z-10 mb-8">
        <h2 className="text-sm font-black text-gray-800 mb-3 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full inline-block shadow-sm" />
          Dashboard Modules
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6 w-full">
          {actionCards.filter(card => card.show).map((card) => (
            <button
              key={card.id}
              onClick={() => navigate(card.path)}
              className="group relative w-full aspect-[4/3] sm:aspect-[16/11] rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl hover:shadow-purple-500/40 transition-all duration-500 hover:-translate-y-2 border-[3px] border-transparent hover:border-purple-300/50"
            >
              {card.image ? (
                <>
                  <img src={card.image} alt={card.label} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" />
                  <div className="absolute inset-0 bg-gradient-to-t from-purple-900/50 via-purple-900/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                  <div className="absolute inset-0 bg-white/20 opacity-0 group-hover:opacity-100 mix-blend-overlay transition-opacity duration-500 pointer-events-none" />
                </>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-emerald-100 to-teal-50 flex items-center justify-center">
                  {card.icon && <card.icon className="w-16 h-16 text-emerald-600/40 group-hover:scale-110 transition-transform duration-500" />}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
