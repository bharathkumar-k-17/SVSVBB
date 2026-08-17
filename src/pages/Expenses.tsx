import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { useExpenses } from '../hooks/queries';
import { supabase } from '../lib/supabase';
import { Receipt, Plus, Trash2, Edit, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { createAdminNotification } from '../lib/notifications';
import { Skeleton } from '../components/ui/Skeleton';

export function Expenses() {
  const { currentYear } = useAppStore();
  const { appUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  const isVolunteer = appUser?.role === 'volunteer';

  const { data: expensesData, isLoading: queryLoading, refetch } = useExpenses(
    currentYear,
    page,
    pageSize,
    isVolunteer
  );
  const displayExpenses = expensesData?.data || [];
  const totalCount = expensesData?.count || 0;
  const totalExpenses = expensesData?.totalExpenses || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Store current state for rollback if needed
    const currentData = { ...formData };
    const currentEditingId = editingId;

    // Instantly clear form & state (Optimistic UI)
    setFormData({
      description: '',
      amount: '',
      category: '',
      date: format(new Date(), 'yyyy-MM-dd')
    });
    setEditingId(null);

    try {
      if (currentEditingId) {
        const { error } = await supabase
          .from('expenses')
          .update({
            description: currentData.description,
            amount: Number(currentData.amount),
            category: currentData.category,
            date: new Date(currentData.date).getTime(),
          })
          .eq('id', currentEditingId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert({
            description: currentData.description,
            amount: Number(currentData.amount),
            category: currentData.category,
            date: new Date(currentData.date).getTime(),
            year: currentYear,
            volunteer_id: appUser?.email || 'admin',
            volunteer_name: appUser?.name || 'Admin',
            created_at: Date.now(),
          });

        if (error) throw error;
        const amountStr = new Intl.NumberFormat('en-IN').format(Number(currentData.amount) || 0);
        await createAdminNotification({
          actor: appUser ?? null,
          type: 'EXPENSES',
          message: `${appUser?.name || 'Volunteer'} added ₹${amountStr} expense for ${currentData.description}.`
        });
      }
    } catch (err: any) {
      console.error(err);
      alert(`Failed to save expense: ${err.message || 'Unknown error'}. Reverting.`);
      setFormData(currentData);
      setEditingId(currentEditingId);
    } finally {
      setLoading(false);
      refetch();
    }
  };

  const handleEdit = (exp: any) => {
    setEditingId(exp.id);
    setFormData({
      description: exp.description,
      amount: exp.amount.toString(),
      category: exp.category,
      date: format(new Date(exp.date), 'yyyy-MM-dd')
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this expense record?')) {
      try {
        const { error } = await supabase
          .from('expenses')
          .delete()
          .eq('id', id);

        if (error) throw error;

        const deletedExp = displayExpenses.find((e: any) => e.id === id);
        if (deletedExp) {
          const amountStr = new Intl.NumberFormat('en-IN').format(deletedExp.amount);
          await createAdminNotification({
            actor: appUser ?? null,
            type: 'EXPENSES',
            message: `${appUser?.name || 'Volunteer'} deleted ₹${amountStr} expense for ${deletedExp.description}.`
          });
        }

        refetch();
      } catch (err: any) {
        console.error(err);
        alert(`Failed to delete expense: ${err.message || 'Unknown error'}`);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-red-50 p-3 rounded-full">
            <Receipt className="text-red-500 h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
              {isVolunteer ? 'Add Expense' : `Expenses ${currentYear}`}
            </h1>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-red-100 p-4 w-full md:w-auto text-right">
          <div className="text-sm font-semibold text-gray-500 uppercase flex items-center justify-end gap-1">
            {isVolunteer ? 'Your Total Spent' : 'Total Spent / Expenses'}
          </div>
          <div className="text-3xl font-bold text-red-600">₹{totalExpenses.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Plus className="text-red-500" /> {editingId ? 'Edit Expense' : 'Add New Expense'}
        </h2>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
            <input
              type="text"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-sm outline-none text-base"
              placeholder=""
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Amount (₹)</label>
            <input
              type="number"
              required
              min="1"
              inputMode="numeric"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-sm outline-none font-bold text-gray-900 text-base"
              placeholder=""
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
            <input
              type="date"
              required
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-sm outline-none text-base"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
            <input
              type="text"
              required
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-sm outline-none text-base"
              placeholder=""
            />
          </div>

          <div className="lg:col-span-4 mt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : (editingId ? 'Update Expense Entry' : 'Add Expense Entry')}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800">
            {isVolunteer ? 'Your Expense Records' : 'Expenses Record'}
          </h3>
        </div>
        <div className="overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-red-50/50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">S.No</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Description</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Category</th>
                {!isVolunteer && <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Added By</th>}
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Amount</th>
                {!isVolunteer && <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {displayExpenses.map((exp, idx) => (
                <tr key={exp.id} className="hover:bg-red-50/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">{page * pageSize + idx + 1}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{format(exp.date, 'dd MMM yyyy')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{exp.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold">{exp.category}</span>
                  </td>
                  {!isVolunteer && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">{exp.volunteerName || 'Admin'}</td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600 text-right">₹{exp.amount.toLocaleString()}</td>
                  {!isVolunteer && (
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex items-center justify-center gap-3">
                        <button onClick={() => handleEdit(exp)} className="text-gray-400 hover:text-primary transition-colors">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(exp.id)} className="text-gray-400 hover:text-red-600 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {displayExpenses.length === 0 && (
                <tr>
                  <td colSpan={isVolunteer ? 5 : 7} className="px-6 py-12 text-center text-gray-500">
                    No expense records found.
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
    </div>
  );
}
