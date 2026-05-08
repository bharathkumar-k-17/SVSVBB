import { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { addDoc, collection, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ShieldAlert, Plus, Trash2, Edit } from 'lucide-react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export function SPLRecords() {
  const { splRecords, currentYear, subscribeToSPLRecords, initialized } = useAppStore();
  const { appUser } = useAuthStore();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  const isAdmin = appUser?.role === 'admin' || appUser?.role === 'super_admin';

  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }
    const unsub = subscribeToSPLRecords();
    return () => unsub();
  }, [isAdmin, currentYear]);

  if (!isAdmin) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Optimistic UI updates
    const currentData = { ...formData };
    const currentEditingId = editingId;
    
    setFormData({
      description: '',
      amount: '',
      date: format(new Date(), 'yyyy-MM-dd')
    });
    setEditingId(null);

    try {
      if (currentEditingId) {
        updateDoc(doc(db, 'spl_records', currentEditingId), {
          description: currentData.description,
          amount: Number(currentData.amount),
          date: new Date(currentData.date).getTime()
        }).catch(err => {
           console.error(err); alert('Failed to update SPL record');
           setFormData(currentData); setEditingId(currentEditingId);
        });
      } else {
        addDoc(collection(db, 'spl_records'), {
          description: currentData.description,
          amount: Number(currentData.amount),
          date: new Date(currentData.date).getTime(),
          year: currentYear,
          createdAt: Date.now()
        }).catch(err => {
           console.error(err); alert('Failed to save SPL record');
           setFormData(currentData);
        });
      }
    } catch (err) {
      console.error(err);
      alert('Failed to save SPL record');
      setFormData(currentData);
      setEditingId(currentEditingId);
    }
  };

  const handleEdit = (rec: any) => {
    setEditingId(rec.id);
    setFormData({
      description: rec.description,
      amount: rec.amount.toString(),
      date: format(new Date(rec.date), 'yyyy-MM-dd')
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this SPL record permanently? (Admin Only)')) {
      await deleteDoc(doc(db, 'spl_records', id));
    }
  };

  const totalSPL = splRecords.reduce((sum, rec) => sum + rec.amount, 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-orange-50 p-3 rounded-full border border-orange-200">
            <ShieldAlert className="text-orange-600 h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">SPL Records {currentYear}</h1>
            <p className="text-gray-500 mt-1 font-semibold text-sm">Internal Admin Operations only.</p>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-orange-100 p-4 w-full md:w-auto text-right">
          <div className="text-sm font-semibold text-gray-500 uppercase">Total Value</div>
          <div className="text-3xl font-bold text-orange-600">₹{totalSPL.toLocaleString()}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Plus className="text-orange-500" /> {editingId ? 'Edit SPL Record' : 'Add SPL Record'}
        </h2>
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
            <input
              type="text"
              required
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 shadow-sm outline-none"
              placeholder=""
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Amount (₹)</label>
            <input
              type="number"
              required
              min="1"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 shadow-sm outline-none font-bold text-gray-900"
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
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 focus:border-orange-500 shadow-sm outline-none"
            />
          </div>
          
          <div className="lg:col-span-3 mt-2">
            <button
              type="submit"
              className="px-8 py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-bold rounded-xl shadow-sm transition-colors"
            >
              {editingId ? 'Update Record' : 'Add Secure Record'}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800">Secure Database</h3>
        </div>
        <div className="overflow-x-auto p-0">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">S.No</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Description</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">Amount</th>
                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {splRecords.map((rec, idx) => (
                <tr key={rec.id} className="hover:bg-orange-50/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">{idx + 1}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{format(rec.date, 'dd MMM yyyy')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{rec.description}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-orange-600 text-right">₹{rec.amount.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                    <div className="flex items-center justify-center gap-3">
                      <button onClick={() => handleEdit(rec)} className="text-gray-400 hover:text-orange-600 transition-colors">
                        <Edit size={16} />
                      </button>
                      <button onClick={() => handleDelete(rec.id)} className="text-gray-400 hover:text-red-600 transition-colors">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!initialized.splRecords && splRecords.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-bold">
                    <div className="flex flex-col items-center justify-center">
                      <div className="h-8 w-8 rounded-full border-4 border-orange-200 border-t-orange-600 animate-spin mb-3"></div>
                      <p>Loading database...</p>
                    </div>
                  </td>
                </tr>
              )}
              {initialized.splRecords && splRecords.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-bold">
                    No SPL records found.
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
