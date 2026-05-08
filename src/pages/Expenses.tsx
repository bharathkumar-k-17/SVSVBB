import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { addDoc, collection, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Receipt, Plus, Trash2, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { createAdminNotification } from '../lib/notifications';

export function Expenses() {
  const { expenses, currentYear, initialized } = useAppStore();
  const { appUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Store current state for rollback if needed
    const currentData = { ...formData };
    const currentEditingId = editingId;
    
    // 1. Instantly clear form & state (Optimistic UI)
    setFormData({
      description: '',
      amount: '',
      category: '',
      date: format(new Date(), 'yyyy-MM-dd')
    });
    setEditingId(null);

    // 2. Fire database action without awaiting (handled in background by Firestore)
    try {
      if (currentEditingId) {
        await updateDoc(doc(db, 'expenses', currentEditingId), {
          description: currentData.description,
          amount: Number(currentData.amount),
          category: currentData.category,
          date: new Date(currentData.date).getTime()
        });
      } else {
        await addDoc(collection(db, 'expenses'), {
          description: currentData.description,
          amount: Number(currentData.amount),
          category: currentData.category,
          date: new Date(currentData.date).getTime(),
          year: currentYear,
          volunteerId: appUser?.uid || 'admin',
          volunteerName: appUser?.name || 'Admin',
          createdAt: Date.now()
        });
        await createAdminNotification({ actor: appUser, type: 'expense', amount: Number(currentData.amount) || 0 });
      }
    } catch (err) {
      console.error(err);
      alert('Failed to save expense. Reverting.');
      setFormData(currentData);
      setEditingId(currentEditingId);
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
      await deleteDoc(doc(db, 'expenses', id));
    }
  };

  const isVolunteer = appUser?.role === 'volunteer';
  const displayExpenses = isVolunteer 
    ? expenses.filter(exp => exp.volunteerId === appUser?.uid)
    : expenses;

  const totalExpenses = displayExpenses.reduce((sum, exp) => sum + exp.amount, 0);

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
          <div className="text-sm font-semibold text-gray-500 uppercase">
            {isVolunteer ? 'Your Total Expenses' : 'Total Expenses'}
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
              onChange={(e) => setFormData({...formData, description: e.target.value})}
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
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
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
              onChange={(e) => setFormData({...formData, date: e.target.value})}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-sm outline-none text-base"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
            <input
              type="text"
              required
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 shadow-sm outline-none text-base"
              placeholder=""
            />
          </div>
          
          <div className="lg:col-span-4 mt-2">
            <button
              type="submit"
              className="px-8 py-3 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl shadow-sm transition-colors"
            >
              {editingId ? 'Update Expense Entry' : 'Add Expense Entry'}
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">{idx + 1}</td>
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
              {!initialized.expenses && displayExpenses.length === 0 && (
                <tr>
                  <td colSpan={isVolunteer ? 5 : 7} className="px-6 py-12 text-center text-gray-500 font-bold">
                    Loading expenses...
                  </td>
                </tr>
              )}
              {initialized.expenses && displayExpenses.length === 0 && (
                <tr>
                  <td colSpan={isVolunteer ? 5 : 7} className="px-6 py-12 text-center text-gray-500">
                    No expense records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
