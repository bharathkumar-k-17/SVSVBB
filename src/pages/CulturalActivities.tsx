import { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { addDoc, collection, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Music, Plus, Trash2, Edit } from 'lucide-react';

export function CulturalActivities() {
  const { culturalEvents, currentYear } = useAppStore();
  const { appUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    gameName: '',
    category: '',
    winner1: '',
    winner2: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingId) {
        await updateDoc(doc(db, 'culturalEvents', editingId), {
          ...formData,
          year: currentYear,
          updatedAt: Date.now()
        });
        setEditingId(null);
      } else {
        await addDoc(collection(db, 'culturalEvents'), {
          ...formData,
          year: currentYear,
          addedBy: appUser?.uid || 'admin',
          addedByName: appUser?.name || 'Admin',
          createdAt: Date.now()
        });
      }
      setFormData({ gameName: '', category: '', winner1: '', winner2: '' });
    } catch (err) {
      console.error(err);
      alert('Failed to save event');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this event?')) {
      await deleteDoc(doc(db, 'culturalEvents', id));
      if (editingId === id) {
        setEditingId(null);
        setFormData({ gameName: '', category: '', winner1: '', winner2: '' });
      }
    }
  };

  const handleEdit = (event: typeof culturalEvents[0]) => {
    setEditingId(event.id);
    setFormData({
      gameName: event.gameName,
      category: event.category,
      winner1: event.winner1,
      winner2: event.winner2 || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  const isVolunteer = appUser?.role === 'volunteer';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-primary/10 p-3 rounded-full">
          <Music className="text-primary h-8 w-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Cultural Activities {currentYear}</h1>

        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-orange-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
          {editingId ? <Edit className="text-primary" /> : <Plus className="text-primary" />} 
          {editingId ? 'Edit Event' : 'Add New Event'}
        </h2>
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Event / Game Name</label>
              <input
                type="text"
                required
                value={formData.gameName}
                onChange={(e) => setFormData({...formData, gameName: e.target.value})}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary shadow-sm outline-none"
                placeholder=""
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
              <input
                type="text"
                required
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary shadow-sm outline-none"
                placeholder=""
              />
            </div>
          </div>
          
          <div className="space-y-4">
             <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">1st Prize Winner</label>
              <input
                type="text"
                required
                value={formData.winner1}
                onChange={(e) => setFormData({...formData, winner1: e.target.value})}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary shadow-sm outline-none"
                placeholder=""
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">2nd Prize Winner</label>
              <input
                type="text"
                value={formData.winner2}
                onChange={(e) => setFormData({...formData, winner2: e.target.value})}
                className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary shadow-sm outline-none"
                placeholder=""
              />
            </div>
          </div>
          
          <div className="md:col-span-2 mt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full md:w-auto px-8 py-3 bg-primary hover:bg-orange-600 text-white font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? 'Saving...' : (editingId ? 'Update Event' : 'Save Event')}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setFormData({ gameName: '', category: '', winner1: '', winner2: '' });
                }}
                className="w-full md:w-auto px-8 py-3 ml-0 md:ml-4 mt-4 md:mt-0 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold rounded-xl shadow-sm transition-colors"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800">Cultural Activities List</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-orange-50/50">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">S.No</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Game / Event</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Category</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  <div className="flex items-center gap-1">🥇 1st Winner</div>
                </th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                  <div className="flex items-center gap-1">🥈 2nd Winner</div>
                </th>
                {!isVolunteer && <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {culturalEvents.map((event, idx) => (
                <tr key={event.id} className="hover:bg-orange-50/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">{idx + 1}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{event.gameName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold">{event.category}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-yellow-700">{event.winner1}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-500">{event.winner2 || '-'}</td>
                  {!isVolunteer && (
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex items-center justify-center gap-3">
                        <button onClick={() => handleEdit(event)} className="text-gray-400 hover:text-primary transition-colors">
                          <Edit size={16} />
                        </button>
                        <button onClick={() => handleDelete(event.id)} className="text-gray-400 hover:text-red-600 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {culturalEvents.length === 0 && (
                <tr>
                  <td colSpan={isVolunteer ? 5 : 6} className="px-6 py-12 text-center text-gray-500">
                    No cultural activity data recorded.
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
