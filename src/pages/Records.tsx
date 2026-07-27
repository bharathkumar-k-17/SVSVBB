import { useEffect, useState, useMemo } from 'react';
import type { CSSProperties } from 'react';
import { format } from 'date-fns';
import { BellRing, BookOpen, CalendarCheck2, MessageCircle } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { A4ExportSystem } from '../components/A4ExportSystem';
import { buildWhatsAppUrl, maskPhoneNumber } from '../lib/privacy';
import type { PoojaSlot } from '../types/pooja';
import { supabase } from '../lib/supabase';
import { useRecordsData } from '../hooks/queries';

type RecordTab = 'devotees' | 'vip' | 'expenses' | 'cultural' | 'volunteer' | 'pooja';

interface VolunteerSummary {
  name: string;
  todayCount: number;
  todayCollection: number;
  totalCount: number;
  totalCollection: number;
  pendingCount: number;
  pendingCollection: number;
}

const tabs: Array<{ id: RecordTab; label: string }> = [
  { id: 'devotees', label: 'All Devotees' },
  { id: 'vip', label: 'VIP Gotram' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'cultural', label: 'Cultural Activities' },
  { id: 'volunteer', label: 'Volunteer Collection' },
  { id: 'pooja', label: 'Pooja Booking' },
];

const singleLineCellStyle: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

function formatCurrency(value: number) {
  return `₹${value.toLocaleString()}`;
}

function renderGridEmptyRow(columnCount: number, absoluteIndex: number) {
  return (
    <tr key={`empty-${columnCount}-${absoluteIndex}`} className="h-6">
      {Array.from({ length: columnCount }, (_, columnIndex) => (
        <td
          key={`empty-cell-${absoluteIndex}-${columnIndex + 1}`}
          className="border border-gray-200 px-1.5 py-1 text-transparent"
        >
          .
        </td>
      ))}
    </tr>
  );
}

export function Records() {
  const { currentYear } = useAppStore();
  const [activeTab, setActiveTab] = useState<RecordTab>('devotees');
  const [sortBy, setSortBy] = useState<'latest' | 'amount' | 'name-asc' | 'name-desc'>('latest');
  
  const { data: recordsData } = useRecordsData(currentYear);
  
  const devotees = recordsData?.devotees || [];
  const expenses = recordsData?.expenses || [];
  const culturalEvents = recordsData?.culturalEvents || [];
  const vipGotrams = recordsData?.vipGotrams || [];
  const poojaBookings = recordsData?.poojaBookings || [];
  const festivalStartDate = recordsData?.festivalStartDate || null;

  const sortedDevotees = useMemo(() => {
    const list = [...devotees];
    switch (sortBy) {
      case 'latest':
        return list.sort((a, b) => b.createdAt - a.createdAt);
      case 'amount':
        return list.sort((a, b) => b.totalAmount - a.totalAmount);
      case 'name-asc':
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case 'name-desc':
        return list.sort((a, b) => b.name.localeCompare(a.name));
      default:
        return list;
    }
  }, [devotees, sortBy]);

  const today = new Date().toDateString();
  const volunteerStats = devotees.reduce<Record<string, VolunteerSummary>>((accumulator, devotee) => {
    const volunteerId = devotee.volunteerId || 'admin';

    if (!accumulator[volunteerId]) {
      accumulator[volunteerId] = {
        name: devotee.volunteerName || 'Unknown Admin',
        todayCount: 0,
        todayCollection: 0,
        totalCount: 0,
        totalCollection: 0,
        pendingCount: 0,
        pendingCollection: 0,
      };
    }

    const summary = accumulator[volunteerId];
    const isToday = new Date(devotee.createdAt).toDateString() === today;

    summary.totalCount += 1;
    summary.totalCollection += devotee.paidAmount;

    if (devotee.pendingAmount > 0) {
      summary.pendingCount += 1;
      summary.pendingCollection += devotee.pendingAmount;
    }

    if (isToday) {
      summary.todayCount += 1;
      summary.todayCollection += devotee.paidAmount;
    }

    return accumulator;
  }, {});

  const volunteersArray = Object.values(volunteerStats);
  const totalDevoteeAmount = devotees.reduce((sum, devotee) => sum + devotee.totalAmount, 0);
  const totalPaidAmount = devotees.reduce((sum, devotee) => sum + devotee.paidAmount, 0);
  const totalPendingAmount = devotees.reduce((sum, devotee) => sum + devotee.pendingAmount, 0);
  const totalExpenseAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  // PDF Export Logic Configuration
  const exportProps = useMemo(() => {
    switch (activeTab) {
      case 'devotees':
        return {
          title: 'All Devotees',
          data: sortedDevotees.map(d => ({ ...d, phone: maskPhoneNumber(d.phone), receivedBy: d.volunteerName || 'Admin', dateStr: format(d.createdAt, 'dd MMM yyyy'), total: formatCurrency(d.totalAmount), paid: formatCurrency(d.paidAmount), pending: d.pendingAmount > 0 ? formatCurrency(d.pendingAmount) : 'NIL', paymentMode: d.paymentMode || 'Cash' })),
          headers: ['Date', 'Name', 'Contact', 'Received By', 'Mode', 'Total', 'Paid', 'Pending'],
          columns: ['dateStr', 'name', 'phone', 'receivedBy', 'paymentMode', 'total', 'paid', 'pending'],
          columnWidths: ['12%', '20%', '13%', '15%', '8%', '10%', '10%', '12%'],
          columnAligns: ['left', 'left', 'left', 'left', 'center', 'right', 'right', 'right'] as ('left' | 'center' | 'right')[],
          footerData: { 
            total: formatCurrency(totalDevoteeAmount), 
            paid: formatCurrency(totalPaidAmount), 
            pending: formatCurrency(totalPendingAmount) 
          } as Record<string, string | number>
        };
      case 'vip':
        return {
          title: 'VIP Gotrams',
          data: vipGotrams.map(v => ({ ...v, members: v.familyMembers.join(', ') })),
          headers: ['గోత్రం', 'కుటుంబ సభ్యులు'],
          columns: ['gotram', 'members'],
          columnWidths: ['20%', '80%'],
          columnAligns: ['left', 'left'] as ('left' | 'center' | 'right')[]
        };
      case 'expenses':
        return {
          title: 'Expenditure',
          data: expenses.map(e => ({ ...e, dateStr: format(e.date, 'dd/MM/yyyy'), amountStr: formatCurrency(e.amount), addedBy: e.volunteerName || 'Admin' })),
          headers: ['Date', 'Description', 'Category', 'Added By', 'Amount'],
          columns: ['dateStr', 'description', 'category', 'addedBy', 'amountStr'],
          columnWidths: ['15%', '35%', '20%', '15%', '15%'],
          columnAligns: ['left', 'left', 'left', 'left', 'right'] as ('left' | 'center' | 'right')[],
          footerData: { amount: formatCurrency(totalExpenseAmount) } as Record<string, string | number>
        };
      case 'cultural':
        return {
          title: 'Cultural Activities',
          data: culturalEvents,
          headers: ['Event Name', 'Category', '1st Prize', '2nd Prize'],
          columns: ['gameName', 'category', 'winner1', 'winner2'],
          columnWidths: ['35%', '20%', '20%', '20%'],
          columnAligns: ['left', 'left', 'left', 'left'] as ('left' | 'center' | 'right')[]
        };
      case 'volunteer':
        return {
          title: 'Volunteer Collection Summary',
          data: volunteersArray.map(v => ({ 
              ...v, 
              todayCollection: formatCurrency(v.todayCollection),
              totalCollection: formatCurrency(v.totalCollection),
              pendingCollection: formatCurrency(v.pendingCollection)
          })),
          headers: ['Volunteer Name', 'Today D', 'Today ₹', 'Total D', 'Total ₹', 'Pend D', 'Pend ₹'],
          columns: ['name', 'todayCount', 'todayCollection', 'totalCount', 'totalCollection', 'pendingCount', 'pendingCollection']
        };
      case 'pooja':
        return {
          title: 'Pooja Bookings',
          data: poojaBookings.flatMap(slot => (slot.families || []).filter((f: any) => f.status === 'active').map((family: any) => ({
            ...family,
            dateStr: (() => {
              if (!festivalStartDate) return '-';
              const d = new Date(festivalStartDate);
              d.setDate(d.getDate() + (slot.day - 1));
              return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
            })(),
            phone: maskPhoneNumber(family.phone),
            slotLabel: `Day ${slot.day} ${slot.time}`,
          }))),
          headers: ['Date', 'Slot', 'Family Name', 'Contact'],
          columns: ['dateStr', 'slotLabel', 'name', 'phone'],
        };
      default:
        return null;
    }
  }, [activeTab, devotees, vipGotrams, expenses, culturalEvents, volunteersArray, totalDevoteeAmount, totalPaidAmount, totalPendingAmount, totalExpenseAmount, poojaBookings]);

  const handlePaymentReminder = async (devotee: any) => {
    await supabase.from('devotees').update({
      triggerReminder: Date.now(),
      reminderType: devotee.paymentStatus,
    }).eq('id', devotee.id);
    const msg = `SVSVBB Chanda Reminder\nDear ${devotee.name},\nPending Amount: ₹${devotee.pendingAmount}\nReceipt No: ${devotee.receiptNo || 'Pending'}`;
    window.open(buildWhatsAppUrl(devotee.phone, msg), '_blank');
  };

  const sendReminder = async (slot: any) => {
    await supabase.from('pooja_slots').update({ reminderRequestedAt: Date.now() }).eq('id', slot.id);
    const activeFamily = (slot.families || []).find((f: any) => f.status === 'active');
    const familyName = activeFamily?.name || '-';
    const familyPhone = activeFamily?.phone || '';
    const msg = `SVSVBB Pooja Booking Reminder\nFamily: ${familyName}\nSlot: Day ${slot.day} ${slot.time}`;
    window.open(buildWhatsAppUrl(familyPhone, msg), '_blank');
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-primary/10 p-3">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Records & Data</h1>
          </div>
        </div>
        <div className="flex gap-3">
          {exportProps && (
            <A4ExportSystem 
              data={exportProps.data}
              title={exportProps.title}
              headers={exportProps.headers}
              columns={exportProps.columns}
              columnWidths={(exportProps as any).columnWidths}
              columnAligns={(exportProps as any).columnAligns}
              footerData={exportProps.footerData}
              year={currentYear}
              filename={`${activeTab}_records`}
            />
          )}
        </div>
      </div>

      <div className="scrollbar-hide mb-6 flex gap-2 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap rounded-xl px-5 py-2.5 font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-primary to-orange-500 text-white shadow-md'
                : 'border border-gray-200 bg-white text-gray-600 shadow-sm hover:bg-orange-50 hover:text-primary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="relative min-h-[500px] overflow-hidden rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="relative z-10 w-full">
          {activeTab === 'devotees' && (
            <>
              {/* Devotee Specific Header: Stats + Sort */}
              <div className="mb-6 space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-xl font-bold text-gray-900 uppercase tracking-tight flex items-center gap-2">
                    <div className="w-2 h-6 bg-primary rounded-full"></div>
                    Devotee List
                  </h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Sort By:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-gray-50 border-2 border-gray-200 text-gray-900 text-sm font-bold rounded-xl focus:ring-primary focus:border-primary block p-2 transition-all hover:border-primary/50 outline-none"
                    >
                      <option value="latest">Latest Entries</option>
                      <option value="amount">Top Amount (High → Low)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-xl border-2 border-gray-300 bg-gray-50 p-4 text-center">
                    <div className="text-sm font-bold uppercase text-gray-500">Grand Total Amount</div>
                    <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalDevoteeAmount)}</div>
                  </div>
                  <div className="rounded-xl border-2 border-green-200 bg-green-50 p-4 text-center">
                    <div className="text-sm font-bold uppercase text-green-700">Total Paid Collection</div>
                    <div className="text-2xl font-bold text-green-700">{formatCurrency(totalPaidAmount)}</div>
                  </div>
                  <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 text-center">
                    <div className="text-sm font-bold uppercase text-red-600">Total Pending Amount</div>
                    <div className="text-2xl font-bold text-red-600">{formatCurrency(totalPendingAmount)}</div>
                  </div>
                </div>
              </div>

              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-black text-black">
                    <th className="w-12 px-2 py-2.5 text-center font-bold">S.No</th>
                    <th className="px-2 py-2.5 font-bold">Date</th>
                    <th className="px-2 py-2.5 font-bold">Name</th>
                    <th className="px-2 py-2.5 font-bold">Receipt</th>
                    <th className="px-2 py-2.5 font-bold">Contact</th>
                    <th className="px-2 py-2.5 font-bold">Received By</th>
                    <th className="px-2 py-2.5 text-center font-bold">Cash/UPI</th>
                    <th className="px-2 py-2.5 text-right font-bold">Total</th>
                    <th className="px-2 py-2.5 text-right font-bold">Paid</th>
                    <th className="px-2 py-2.5 text-right font-bold">Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300">
                  {sortedDevotees.map((devotee, index) => (
                    <tr key={devotee.id} className="hover:bg-gray-50">
                      <td className="px-2 py-2 text-center font-bold">{index + 1}</td>
                      <td className="px-2 py-2 font-bold">{format(devotee.createdAt, 'dd MMM yyyy')}</td>
                      <td className="px-2 py-2 font-bold uppercase">{devotee.name}</td>
                      <td className="px-2 py-2 font-bold">{devotee.receiptNo}</td>
                      <td className="px-2 py-2 font-bold">{maskPhoneNumber(devotee.phone)}</td>
                      <td className="px-2 py-2 font-bold">{devotee.volunteerName || 'Admin'}</td>
                      <td className="px-2 py-2 text-center font-bold">
                        <span className={`inline-block text-[10px] px-2 py-0.5 rounded border ${
                          devotee.paymentMode === 'UPI' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {devotee.paymentMode || 'Cash'}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right font-bold">{formatCurrency(devotee.totalAmount)}</td>
                      <td className="px-2 py-2 text-right font-bold text-green-700">
                        {formatCurrency(devotee.paidAmount)}
                      </td>
                      <td className="px-2 py-2 text-right font-bold text-red-600">
                        {devotee.pendingAmount > 0 ? formatCurrency(devotee.pendingAmount) : 'NIL'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-black bg-gray-50 font-bold text-black">
                  <tr>
                    <td colSpan={7} className="px-2 py-3 text-right uppercase">
                      Total:
                    </td>
                    <td className="px-2 py-3 text-right text-base">{formatCurrency(totalDevoteeAmount)}</td>
                    <td className="px-2 py-3 text-right text-base text-green-700">
                      {formatCurrency(totalPaidAmount)}
                    </td>
                    <td className="px-2 py-3 text-right text-base text-red-600">
                      {formatCurrency(totalPendingAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}

          {activeTab === 'vip' && (
            <table className="w-full border-collapse text-left text-sm max-w-4xl">
              <thead>
                <tr className="border-b-2 border-black text-black">
                  <th className="w-16 px-4 py-2.5 font-bold text-center">S.No</th>
                  <th className="w-1/6 px-4 py-2.5 font-bold">గోత్రం</th>
                  <th className="px-4 py-2.5 font-bold">కుటుంబ సభ్యులు</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {vipGotrams.map((vip, index) => (
                  <tr key={vip.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-center font-bold">{index + 1}</td>
                    <td className="px-4 py-3 font-bold uppercase">{vip.gotram}</td>
                    <td className="px-4 py-3 font-bold leading-relaxed">{vip.familyMembers.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'expenses' && (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-black text-black">
                  <th className="w-16 px-2 py-2.5 text-center font-bold">S.No</th>
                  <th className="w-32 px-2 py-2.5 font-bold">Date</th>
                  <th className="px-2 py-2.5 font-bold">Description</th>
                  <th className="w-32 px-2 py-2.5 font-bold">Category</th>
                  <th className="w-32 px-2 py-2.5 font-bold">Added By</th>
                  <th className="w-32 px-2 py-2.5 text-right font-bold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {expenses.map((expense, index) => (
                  <tr key={expense.id} className="hover:bg-gray-50">
                    <td className="px-2 py-2 text-center font-bold">{index + 1}</td>
                    <td className="px-2 py-2 font-bold">{format(expense.date, 'dd/MM/yyyy')}</td>
                    <td className="px-2 py-2 font-bold uppercase">{expense.description}</td>
                    <td className="px-2 py-2 font-bold">{expense.category}</td>
                    <td className="px-2 py-2 font-bold text-gray-700">{expense.volunteerName || 'Admin'}</td>
                    <td className="px-2 py-2 text-right font-bold text-red-600">
                      {formatCurrency(expense.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-black bg-gray-50 font-bold text-black">
                <tr>
                  <td colSpan={5} className="px-2 py-3 text-right uppercase">
                    Total Expenditures:
                  </td>
                  <td className="px-2 py-3 text-right text-base text-red-600">
                    {formatCurrency(totalExpenseAmount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}

          {activeTab === 'cultural' && (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-black text-black">
                  <th className="w-16 px-4 py-2.5 text-center font-bold">S.No</th>
                  <th className="px-4 py-2.5 font-bold">Event Name</th>
                  <th className="px-4 py-2.5 font-bold">Category</th>
                  <th className="px-4 py-2.5 font-bold text-green-700">1st Prize</th>
                  <th className="px-4 py-2.5 font-bold text-orange-600">2nd Prize</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {culturalEvents.map((event, index) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-center font-bold">{index + 1}</td>
                    <td className="px-4 py-3 font-bold uppercase">{event.gameName}</td>
                    <td className="px-4 py-3 font-bold">{event.category}</td>
                    <td className="px-4 py-3 font-bold text-green-800">{event.winner1}</td>
                    <td className="px-4 py-3 font-bold text-orange-800">{event.winner2 || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'volunteer' && (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr>
                  <th className="border-b-2 border-black px-4 py-2.5 text-center font-bold text-black" rowSpan={2}>
                    S.No
                  </th>
                  <th className="border-b-2 border-black px-4 py-2.5 font-bold text-black" rowSpan={2}>
                    Volunteer Name
                  </th>
                  <th className="border-b border-black bg-gray-50 px-4 py-2 text-center font-bold text-black" colSpan={2}>
                    Today's Collection
                  </th>
                  <th className="border-b border-black bg-gray-100 px-4 py-2 text-center font-bold text-black" colSpan={2}>
                    Total Collection
                  </th>
                  <th className="border-b border-black bg-red-50 px-4 py-2 text-center font-bold text-black" colSpan={2}>
                    Pending
                  </th>
                </tr>
                <tr className="border-b-2 border-black text-black">
                  <th className="bg-gray-50 px-4 py-2 text-center font-bold">Devotees</th>
                  <th className="bg-gray-50 px-4 py-2 text-right font-bold">Amount</th>
                  <th className="bg-gray-100 px-4 py-2 text-center font-bold">Devotees</th>
                  <th className="bg-gray-100 px-4 py-2 text-right font-bold">Amount</th>
                  <th className="bg-red-50 px-4 py-2 text-center font-bold">Devotees</th>
                  <th className="bg-red-50 px-4 py-2 text-right font-bold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {volunteersArray.map((volunteer, index) => (
                  <tr key={`${volunteer.name}-${index + 1}`} className="hover:bg-orange-50/20">
                    <td className="px-4 py-3 text-center font-bold">{index + 1}</td>
                    <td className="px-4 py-3 font-bold uppercase">{volunteer.name}</td>
                    <td className="border-l border-gray-300 bg-gray-50/50 px-4 py-3 text-center font-bold">
                      {volunteer.todayCount}
                    </td>
                    <td className="bg-gray-50/50 px-4 py-3 text-right font-bold text-green-700">
                      {formatCurrency(volunteer.todayCollection)}
                    </td>
                    <td className="border-l border-gray-300 bg-gray-100/50 px-4 py-3 text-center font-bold">
                      {volunteer.totalCount}
                    </td>
                    <td className="bg-gray-100/50 px-4 py-3 text-right font-bold text-primary">
                      {formatCurrency(volunteer.totalCollection)}
                    </td>
                    <td className="border-l border-gray-300 bg-red-50/50 px-4 py-3 text-center font-bold">
                      {volunteer.pendingCount}
                    </td>
                    <td className="bg-red-50/50 px-4 py-3 text-right font-bold text-red-600">
                      {formatCurrency(volunteer.pendingCollection)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === 'pooja' && (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-black text-black">
                  <th className="w-16 px-4 py-2.5 text-center font-bold">S.No</th>
                  <th className="px-4 py-2.5 font-bold">Date</th>
                  <th className="px-4 py-2.5 font-bold">Slot</th>
                  <th className="px-4 py-2.5 font-bold">Family Name</th>
                  <th className="px-4 py-2.5 font-bold">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-300">
                {poojaBookings.flatMap(slot => (slot.families || []).filter((f: any) => f.status === 'active').map((family: any) => ({
                  ...family,
                  slotDay: slot.day,
                  slotTime: slot.time,
                }))).map((item, index) => (
                  <tr key={item.id} className="hover:bg-orange-50/20">
                    <td className="px-4 py-3 text-center font-bold">{index + 1}</td>
                    <td className="px-4 py-3 font-bold">
                       {(() => {
                          if (!festivalStartDate) return '-';
                          const d = new Date(festivalStartDate);
                          d.setDate(d.getDate() + (item.slotDay - 1));
                          return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
                       })()}
                    </td>
                    <td className="px-4 py-3 font-bold capitalize">Day {item.slotDay} {item.slotTime}</td>
                    <td className="px-4 py-3 font-bold uppercase">{item.name}</td>
                    <td className="px-4 py-3 font-bold">{maskPhoneNumber(item.phone)}</td>
                  </tr>
                ))}
                {poojaBookings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      No pooja bookings recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
