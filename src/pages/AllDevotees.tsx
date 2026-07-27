import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { useDevotees } from '../hooks/queries';
import { useDebounce } from '../hooks/useDebounce';
import { Search, Filter, Trash2, Edit, Plus, Crown, MessageCircle, MessageSquare, ArrowUpDown, BellRing, ChevronLeft, ChevronRight } from 'lucide-react';
import { PaymentModal } from '../components/PaymentModal';
import { EditDevoteeModal } from '../components/EditDevoteeModal';
import { supabase } from '../lib/supabase';
import { maskPhoneNumber, getWhatsAppNumber } from '../lib/privacy';
import { Skeleton } from '../components/ui/Skeleton';

type SortOption = 'LATEST' | 'AMOUNT_DESC';

function formatCurrency(value: number) {
  return `₹${value.toLocaleString()}`;
}

export function AllDevotees() {
  const { currentYear } = useAppStore();
  const { appUser } = useAuthStore();
  
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  
  const [filter, setFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('LATEST');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const [selectedDevotee, setSelectedDevotee] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  const isAdmin = appUser?.role === 'admin' || appUser?.role === 'superadmin';
  const isVolunteer = appUser?.role === 'volunteer';

  const { data: devoteesData, isLoading, refetch } = useDevotees(
    currentYear,
    page,
    pageSize,
    debouncedSearch,
    filter,
    sortBy
  );

  const devotees = devoteesData?.data || [];
  const totalCount = devoteesData?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Reset page when filters change
  const handleFilterChange = (f: string) => {
    setFilter(f);
    setPage(0);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    setPage(0);
  };

  const handleSortChange = (s: SortOption) => {
    setSortBy(s);
    setPage(0);
  };

  const handleAddPayment = (dev: any) => {
    setSelectedDevotee(dev);
    setShowPaymentModal(true);
  };

  const handleEditDevotee = (dev: any) => {
    setSelectedDevotee(dev);
    setShowEditModal(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this devotee record?')) {
      try {
        const { error } = await supabase
          .from('devotees')
          .delete()
          .eq('id', id);

        if (error) throw error;
      } catch (err: any) {
        console.error(err);
        alert(`Failed to delete devotee record: ${err.message || 'Unknown error'}`);
      }
    }
  };

  const handleWhatsAppShare = (dev: any) => {
    try {
      const targetPhone = getWhatsAppNumber(dev.phone);
      
      if (!targetPhone) {
        alert("Invalid or missing phone number for WhatsApp sharing.");
        return;
      }

      const baseUrl = window.location.origin;
      const receiptUrl = `${baseUrl}/portal/receipt/${dev.id}`;
      
      const paymentMsg = dev.paymentMode === 'UPI' && dev.paidAmount === 0 
        ? 'మీ చందా నమోదు చేయబడింది.' 
        : 'మీ చందా విజయవంతంగా నమోదు చేయబడింది.';
        
      const text = `🙏 నమస్కారం 🙏\n\nశ్రీ వరసిద్ధి వినాయక భక్త బృందం\n\n${paymentMsg}\n\nపేరు: ${dev.name}\nరసీదు నం: ${dev.receiptNo}\nమొత్తం: ₹${dev.totalAmount}\nచెల్లింపు విధానం: ${dev.paymentMode || 'Cash'}\n\nరసీదు చూడటానికి / డౌన్లోడ్ చేసుకోవడానికి:\n${receiptUrl}\n\n🙏 ధన్యవాదాలు 🙏`;

      const waLink = `https://wa.me/${targetPhone}?text=${encodeURIComponent(text)}`;
      console.log('Target Phone:', targetPhone, 'WA Link:', waLink);
      window.open(waLink, '_blank');
      
    } catch (e) {
      console.error("WhatsApp share error:", e);
    }
  };

  const handleSMSShare = (dev: any) => {
    const isAck = dev.paidAmount === 0;
    const msg = isAck ? 
      `శ్రీ వరసిద్ధి వినాయక భక్త బృందం - ${currentYear}\n\nపేరు: ${dev.name}\nమొత్తం: ₹${dev.totalAmount}\n\nమీ వివరాలు నమోదు చేయబడ్డాయి.\nచెల్లింపు పెండింగ్లో ఉంది.\n\nధన్యవాదాలు 🙏` :
      `శ్రీ వరసిద్ధి వినాయక భక్త బృందం - ${currentYear}\n\nపేరు: ${dev.name}\nచెల్లించిన మొత్తం: ₹${dev.paidAmount}\nరసీదు నం: ${dev.receiptNo}\n${dev.pendingAmount > 0 ? `\nమిగిలిన మొత్తం: ₹${dev.pendingAmount}\nదయచేసి చెల్లించండి.\n` : ''}\nధన్యవాదాలు 🙏`;

    window.open(`sms:${dev.phone}?body=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleSendReminder = async (dev: any) => {
    if (window.confirm(`Send payment reminder SMS to ${dev.name}?`)) {
      try {
        const { error } = await supabase
          .from('devotees')
          .update({ trigger_reminder: Date.now() })
          .eq('id', dev.id);

        if (error) throw error;
        alert('Reminder SMS triggered successfully!');
      } catch (err: any) {
        console.error('Failed to trigger reminder:', err);
        alert(`Failed to send reminder: ${err.message || 'Please check your connection.'}`);
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Filter className="text-primary" />
            All Devotees {currentYear}
          </h1>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="flex bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden text-sm w-full sm:w-auto">
            {['ALL', 'PAID', 'PARTIAL', 'UNPAID', 'VIP'].map(f => (
            <button
              key={f}
              onClick={() => handleFilterChange(f)}
              className={`flex-1 sm:flex-none px-4 py-2 font-medium transition-colors ${
                filter === f 
                  ? 'bg-primary text-white' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              } ${f !== 'VIP' ? 'border-r border-gray-200' : ''}`}
            >
              {f}
            </button>
          ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden flex flex-col h-[calc(100vh-280px)]">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col lg:flex-row gap-4 justify-between items-center">
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto flex-1">
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder=""
                value={searchInput}
                onChange={handleSearchChange}
                className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary shadow-sm outline-none text-sm transition-all"
              />
            </div>

            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <ArrowUpDown className="h-4 w-4 text-gray-400" />
              </div>
              <select
                value={sortBy}
                onChange={(e) => handleSortChange(e.target.value as SortOption)}
                className="pl-9 pr-8 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary shadow-sm outline-none text-sm appearance-none bg-white font-medium text-gray-700 cursor-pointer"
              >
                <option value="LATEST">Sort By: Latest</option>
                <option value="AMOUNT_DESC">Top Amount</option>
              </select>
              <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="text-sm text-gray-500 font-semibold bg-gray-100 px-3 py-1 rounded-full whitespace-nowrap">
            {totalCount} Devotees
          </div>
        </div>

        <div className="flex-1 overflow-auto rounded-b-2xl scroll-smooth">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm border-separate border-spacing-0">
            <thead className="bg-orange-50/80 sticky top-0 z-10 backdrop-blur-md">
              <tr>
                <th className="px-6 py-4 font-bold text-gray-900 border-b border-orange-100">Receipt / Name</th>
                <th className="px-6 py-4 font-bold text-gray-900 border-b border-orange-100">Contact</th>
                <th className="px-6 py-4 font-bold text-gray-900 text-center border-b border-orange-100">Cash/UPI</th>
                <th className="px-6 py-4 font-bold text-gray-900 text-right border-b border-orange-100">Total</th>
                <th className="px-6 py-4 font-bold text-gray-900 text-right border-b border-orange-100">Paid</th>
                <th className="px-6 py-4 font-bold text-gray-900 text-right border-b border-orange-100">Pending</th>
                {!isVolunteer && <th className="px-6 py-4 font-bold text-gray-900 text-center border-b border-orange-100">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {devotees.map((dev) => (
                <tr 
                  key={dev.id} 
                  className="hover:bg-orange-50/40 transition-all group"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900 flex items-center gap-2">
                          {dev.name} {dev.totalAmount >= 1000 && <span title="VIP"><Crown size={14} className="text-[#cfa052]" /></span>}
                        </span>
                        <span className="text-xs text-gray-500 font-mono tracking-wider">{dev.receiptNo}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-medium">
                    {maskPhoneNumber(dev.phone)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded border ${
                      dev.paymentMode === 'UPI' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      {dev.paymentMode || 'Cash'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-gray-900">
                    ₹{(dev.totalAmount || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-green-700">
                    ₹{(dev.paidAmount || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-red-600">
                    ₹{(dev.pendingAmount || 0).toLocaleString()}
                  </td>
                    {!isVolunteer && (
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                          <div className="flex items-center justify-center gap-2 opacity-90 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleWhatsAppShare(dev)} className="text-green-600 hover:text-green-800 bg-green-50 hover:bg-green-100 p-2 rounded-xl transition-all hover:scale-110" title="Share via WhatsApp">
                              <MessageCircle size={18} />
                            </button>
                            <button onClick={() => handleSMSShare(dev)} className="text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 p-2 rounded-xl transition-all hover:scale-110" title="Share via SMS">
                              <MessageSquare size={18} />
                            </button>

                            {dev.pendingAmount > 0 && (
                              <button onClick={() => handleSendReminder(dev)} className="text-orange-600 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 p-2 rounded-xl transition-all hover:scale-110 border border-orange-200 shadow-sm" title="Send SMS Reminder">
                                 <BellRing size={18} className="animate-pulse" />
                              </button>
                            )}
                          
                            {dev.pendingAmount > 0 && (
                              <button onClick={() => {
                                handleAddPayment(dev);
                                refetch();
                              }} className="text-white hover:text-white bg-primary hover:bg-orange-700 py-2 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm hover:shadow-md hover:-translate-y-0.5" title="Collect Payment">
                                <Plus size={16} /> <span className="text-xs font-bold whitespace-nowrap">Collect</span>
                              </button>
                            )}
                            
                            {isAdmin && (
                              <div className="flex gap-1">
                                <button onClick={() => {
                                  handleEditDevotee(dev);
                                  refetch();
                                }} className="text-gray-500 hover:text-indigo-600 bg-gray-100 hover:bg-indigo-50 p-2 rounded-xl transition-all" title="Edit">
                                  <Edit size={18} />
                                </button>
                                <button onClick={async () => {
                                  await handleDelete(dev.id);
                                  refetch();
                                }} className="text-gray-500 hover:text-red-600 bg-gray-100 hover:bg-red-50 p-2 rounded-xl transition-all" title="Delete">
                                  <Trash2 size={18} />
                                </button>
                              </div>
                            )}
                          </div>
                      </td>
                    )}
                  </tr>
              ))}
              {devotees.length === 0 && (
                <tr>
                  <td colSpan={isVolunteer ? 6 : 7} className="px-6 py-20 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center">
                      <div className="bg-gray-100 p-6 rounded-full mb-4">
                        <Search className="h-12 w-12 text-gray-300" />
                      </div>
                      <p className="text-xl font-bold text-gray-900">No devotees found</p>
                      <p className="text-sm max-w-xs mx-auto">We couldn't find any records matching your search or filter criteria. Try broadening your query.</p>
                      {(searchInput || filter !== 'ALL') && (
                        <button 
                          onClick={() => { setSearchInput(''); setFilter('ALL'); }}
                          className="mt-6 text-primary font-bold hover:underline"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
             <div className="text-sm text-gray-600">
               Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, totalCount)} of {totalCount} entries
             </div>
             <div className="flex gap-2">
               <button
                 onClick={() => setPage(p => Math.max(0, p - 1))}
                 disabled={page === 0}
                 className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50"
               >
                 <ChevronLeft className="h-4 w-4" />
               </button>
               <button
                 onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                 disabled={page >= totalPages - 1}
                 className="p-2 rounded-lg bg-white border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50"
               >
                 <ChevronRight className="h-4 w-4" />
               </button>
             </div>
          </div>
        )}
      </div>

      {showPaymentModal && selectedDevotee && (
        <PaymentModal devotee={selectedDevotee} onClose={() => setShowPaymentModal(false)} />
      )}
      {showEditModal && selectedDevotee && (
        <EditDevoteeModal devotee={selectedDevotee} onClose={() => setShowEditModal(false)} />
      )}
    </div>
  );
}
