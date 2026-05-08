import React, { useState } from 'react';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Save, X } from 'lucide-react';
import { MaskedPhoneInput } from './MaskedPhoneInput';
import { normalizePhoneDigits } from '../lib/privacy';

export function EditDevoteeModal({ devotee, onClose }: { devotee: any, onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: devotee.name,
    phone: devotee.phone,
    totalAmount: devotee.totalAmount,
    paidAmount: devotee.paidAmount,
    donationItem: devotee.donationItem || '',
    gotram: devotee.gotram || '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const pending = Number(formData.totalAmount) - Number(formData.paidAmount);
      const status = pending <= 0 ? 'PAID' : (Number(formData.paidAmount) > 0 ? 'PARTIAL' : 'UNPAID');

      await updateDoc(doc(db, 'devotees', devotee.id), {
        name: formData.name,
        phone: normalizePhoneDigits(formData.phone),
        totalAmount: Number(formData.totalAmount),
        paidAmount: Number(formData.paidAmount),
        pendingAmount: pending <= 0 ? 0 : pending,
        donationItem: formData.donationItem,
        gotram: formData.gotram,
        paymentStatus: status
      });
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to update devotee');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden relative">
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-xl font-bold text-gray-800">Edit Devotee</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-red-600 transition-colors p-1">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
              <input type="text" required value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
              <MaskedPhoneInput required value={formData.phone} onChange={(phone) => setFormData({...formData, phone})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Total Amount (₹)</label>
              <input type="number" required value={formData.totalAmount} onChange={(e) => setFormData({...formData, totalAmount: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Paid Amount (₹)</label>
              <input type="number" required value={formData.paidAmount} onChange={(e) => setFormData({...formData, paidAmount: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Item / In-kind</label>
              <input type="text" value={formData.donationItem} onChange={(e) => setFormData({...formData, donationItem: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Gotram</label>
              <input type="text" value={formData.gotram} onChange={(e) => setFormData({...formData, gotram: e.target.value})} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none" />
            </div>
          </div>
          
          <button type="submit" disabled={loading} className="w-full mt-6 py-3 bg-primary hover:bg-orange-700 text-white font-bold rounded-xl shadow-sm transition-colors flex justify-center items-center gap-2">
            <Save size={18} /> {loading ? 'Saving...' : 'Update Records'}
          </button>
        </form>
      </div>
    </div>
  );
}
