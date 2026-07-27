import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { usePayments } from '../hooks/queries';
import { useDebounce } from '../hooks/useDebounce';
import { Search, Edit, Trash2, Wallet, QrCode, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { EditDevoteeModal } from '../components/EditDevoteeModal';
import { maskPhoneNumber } from '../lib/privacy';
import { Skeleton } from '../components/ui/Skeleton';

export function Payments() {
  const { currentYear } = useAppStore();
  const { appUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'Cash' | 'UPI'>('Cash');
  const [searchInput, setSearchInput] = useState('');
  const debouncedSearch = useDebounce(searchInput, 300);
  
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedDevotee, setSelectedDevotee] = useState<any>(null);

  const isAdmin = appUser?.role === 'admin' || appUser?.role === 'superadmin';

  const { data: paymentsData, isLoading, refetch } = usePayments(
    currentYear,
    page,
    pageSize,
    debouncedSearch,
    activeTab
  );

  const displayedPayments = paymentsData?.data || [];
  const totalCount = paymentsData?.count || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleTabChange = (tab: 'Cash' | 'UPI') => {
    setActiveTab(tab);
    setPage(0);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    setPage(0);
  };
  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this payment record entirely?')) {
      try {
        const { error } = await supabase
          .from('devotees')
          .delete()
          .eq('id', id);

        if (error) throw error;
        refetch();
      } catch (err: any) {
        console.error(err);
        alert(`Failed to delete: ${err.message || 'Unknown error'}`);
      }
    }
  };

  const handleEdit = (dev: any) => {
    setSelectedDevotee(dev);
    setShowEditModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            Payment List
          </h1>

        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-orange-100 min-h-[500px] flex flex-col">
        {/* Header Tabs */}
        <div className="border-b border-orange-100 bg-orange-50/50 p-4 sm:px-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex gap-4">
              <button
                onClick={() => handleTabChange('Cash')}
                className={`flex items-center gap-2 pb-4 -mb-4 px-2 text-sm font-bold border-b-2 transition-colors ${
                  activeTab === 'Cash' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Wallet className="w-4 h-4" />
                Cash Payments
              </button>
              <button
                onClick={() => handleTabChange('UPI')}
                className={`flex items-center gap-2 pb-4 -mb-4 px-2 text-sm font-bold border-b-2 transition-colors ${
                  activeTab === 'UPI' 
                    ? 'border-primary text-primary' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <QrCode className="w-4 h-4" />
                UPI Payments
              </button>
            </div>

            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder=""
                value={searchInput}
                onChange={handleSearchChange}
                className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-full focus:ring-2 focus:ring-primary focus:border-transparent w-full outline-none"
              />
            </div>
          </div>
        </div>

        {/* List Data */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-600 text-sm border-b border-gray-100">
                <th className="px-6 py-4 font-semibold">Devotee details</th>
                <th className="px-6 py-4 font-semibold">Total Amount</th>
                <th className="px-6 py-4 font-semibold">Amount Paid</th>
                <th className="px-6 py-4 font-semibold text-center status-col">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: pageSize }).map((_, idx) => (
                  <tr key={idx} className="hover:bg-orange-50/20 transition-colors">
                    <td className="px-6 py-4">
                      <Skeleton className="h-5 w-40 mb-1" />
                      <Skeleton className="h-3 w-32 mb-1" />
                      <Skeleton className="h-3 w-16" />
                    </td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-24" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-24" /></td>
                    <td className="px-6 py-4"><Skeleton className="h-6 w-16 mx-auto rounded-full" /></td>
                  </tr>
                ))
              ) : displayedPayments.length > 0 ? displayedPayments.map((dev) => (
                <tr key={dev.id} className="hover:bg-orange-50/20 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-gray-800 text-base">{dev.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {maskPhoneNumber(dev.phone)} &bull; {dev.createdAt ? format(new Date(dev.createdAt), 'dd MMM yy, hh:mm a') : 'N/A'}
                    </p>
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">{dev.receiptNo}</p>
                  </td>
                  <td className="px-6 py-4 font-bold text-gray-600 text-lg">
                    ₹{(dev.totalAmount || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 font-black text-green-700 text-lg">
                    ₹{(dev.paidAmount || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      dev.paymentStatus === 'PAID' ? 'bg-green-100 text-green-700 border border-green-200' :
                      dev.paymentStatus === 'PARTIAL' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-red-100 text-red-700 border border-red-200'
                    }`}>
                      {dev.paymentStatus}
                    </span>
                  </td>

                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center text-gray-500 font-medium text-sm">
                    No {activeTab} payments found matching your criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Controls */}
        {!isLoading && totalPages > 1 && (
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-between mt-auto">
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

      {showEditModal && selectedDevotee && (
        <EditDevoteeModal devotee={selectedDevotee} onClose={() => setShowEditModal(false)} />
      )}
    </div>
  );
}
