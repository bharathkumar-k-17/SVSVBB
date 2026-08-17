import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Save, X, Edit2, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { MaskedPhoneInput } from './MaskedPhoneInput';
import { normalizePhoneDigits } from '../lib/privacy';
import { TeluguInput } from './TeluguInput';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';

export function EditDevoteeModal({ devotee, onClose }: { devotee: any, onClose: () => void }) {
  const { appUser } = useAuthStore();
  const isAdminOrSuper = appUser?.role === 'ADMIN' as any || appUser?.role === 'SUPER_ADMIN' as any || appUser?.role === 'admin' as any || appUser?.role === 'superadmin' as any;

  const [formData, setFormData] = useState({
    name: devotee.name,
    phone: devotee.phone,
    totalAmount: devotee.totalAmount,
    paidAmount: devotee.paidAmount,
    donationItem: devotee.donationItem || '',
    gotram: devotee.gotram || '',
    receiptNo: devotee.receiptNo || devotee.receipt_no || '',
  });

  const [isEditingReceipt, setIsEditingReceipt] = useState(false);
  const [receiptStatus, setReceiptStatus] = useState<string | null>(null);
  const [gapWarning, setGapWarning] = useState(false);
  const [gapConfirmed, setGapConfirmed] = useState(false);

  useEffect(() => {
    if (!isEditingReceipt) return;
    const currentRno = devotee.receiptNo || devotee.receipt_no;

    if (formData.receiptNo === currentRno) {
      setReceiptStatus(null);
      setGapWarning(false);
      return;
    }

    const check = async () => {
      const val = formData.receiptNo.toUpperCase();
      if (!/^G\d{2}-\d{3,}$/.test(val)) {
        setReceiptStatus('Invalid format');
        setGapWarning(false);
        return;
      }

      const objYear = devotee.year || parseInt('20' + currentRno.substring(1, 3), 10) || new Date().getFullYear();
      const receiptYearSuffix = val.substring(1, 3);
      const objYearSuffix = objYear.toString().slice(-2);

      if (receiptYearSuffix !== objYearSuffix) {
        setReceiptStatus(`Must belong to year ${objYear}`);
        setGapWarning(false);
        return;
      }

      setReceiptStatus('Checking...');

      const { data: existing } = await supabase.from('devotees')
        .select('id')
        .eq('receipt_no', val)
        .limit(1);

      if (existing && existing.length > 0 && existing[0].id !== devotee.id) {
        setReceiptStatus('In Use');
        setGapWarning(false);
        return;
      }

      const targetCount = parseInt(val.split('-')[1], 10);
      const { data: allDevs } = await supabase.from('devotees').select('receipt_no').eq('year', objYear);
      const used = new Set(allDevs?.map(d => parseInt((d.receipt_no || '').split('-')[1], 10)).filter(n => !isNaN(n)) || []);

      let gap = false;
      for (let i = 1; i < targetCount; i++) {
        if (!used.has(i) && i !== parseInt(currentRno.split('-')[1], 10)) {
          gap = true;
          break;
        }
      }

      setGapWarning(gap);
      setReceiptStatus('Available');
    };

    const debounceId = setTimeout(check, 400);
    return () => clearTimeout(debounceId);
  }, [formData.receiptNo, isEditingReceipt, devotee]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentRno = devotee.receiptNo || devotee.receipt_no;

    if (isEditingReceipt && formData.receiptNo !== currentRno) {
      if (receiptStatus !== 'Available') {
        toast.error(receiptStatus === 'In Use' ? `Receipt number ${formData.receiptNo} is already in use.` : 'Please provide a valid, available receipt number.');
        return;
      }
      if (gapWarning && !gapConfirmed) {
        toast.error("Please confirm the sequence gap to proceed.");
        return;
      }
    }

    setLoading(true);
    try {
      const pending = Number(formData.totalAmount) - Number(formData.paidAmount);
      const status = pending <= 0 ? 'PAID' : (Number(formData.paidAmount) > 0 ? 'PARTIAL' : 'UNPAID');

      const { error } = await supabase
        .from('devotees')
        .update({
          name: formData.name,
          phone: normalizePhoneDigits(formData.phone),
          total_amount: Number(formData.totalAmount),
          paid_amount: Number(formData.paidAmount),
          pending_amount: pending <= 0 ? 0 : pending,
          donation_item: formData.donationItem,
          gotram: formData.gotram,
          payment_status: status,
          ...(isEditingReceipt && formData.receiptNo !== (devotee.receiptNo || devotee.receipt_no) ? { receipt_no: formData.receiptNo.toUpperCase() } : {})
        })
        .eq('id', devotee.id);

      if (error) throw error;
      toast.success('Record updated successfully');
      onClose();
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to update devotee: ${err.message || 'Unknown error'}`);
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

            {/* Receipt Number Block */}
            <div className="col-span-2 border rounded-xl p-4 bg-gray-50/50 mb-2">
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-bold text-gray-800">Receipt No.</label>
                {isAdminOrSuper && !isEditingReceipt && (
                  <button type="button" onClick={() => setIsEditingReceipt(true)} className="text-xs bg-white border border-gray-200 px-3 py-1 rounded-lg text-red-600 font-bold hover:bg-red-50 flex items-center gap-1 shadow-sm transition-colors">
                    <Edit2 size={12} /> Edit
                  </button>
                )}
              </div>

              {!isEditingReceipt ? (
                <div className="text-xl font-black text-gray-900 tracking-wider bg-white px-4 py-2 rounded-lg border border-gray-200 inline-block shadow-sm">
                  {devotee.receiptNo || devotee.receipt_no}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex-[0.8] bg-white p-2.5 rounded-lg border border-gray-200 inline-block text-xs text-gray-400 font-bold shadow-sm">
                      Current: <span className="text-gray-800 text-sm ml-1">{devotee.receiptNo || devotee.receipt_no}</span>
                    </div>
                    <div className="text-gray-400 font-black">→</div>
                    <div className="flex-[1.2] relative">
                      <input
                        type="text"
                        value={formData.receiptNo}
                        onChange={(e) => {
                          setFormData({ ...formData, receiptNo: e.target.value.toUpperCase() });
                          setGapConfirmed(false);
                        }}
                        className="w-full px-3 py-2 border-2 border-red-200 rounded-lg focus:border-red-500 outline-none font-black text-gray-900 uppercase tracking-widest shadow-sm"
                        placeholder="G26-001"
                      />
                    </div>
                  </div>

                  {formData.receiptNo !== (devotee.receiptNo || devotee.receipt_no) && (
                    <div className="flex items-center gap-2 text-sm font-bold">
                      {receiptStatus === 'Checking...' && <span className="text-gray-500 animate-pulse">{receiptStatus}</span>}
                      {receiptStatus === 'Invalid format' && <span className="text-orange-600 flex items-center gap-1"><XCircle size={14} /> Invalid format</span>}
                      {receiptStatus && receiptStatus.startsWith('Must belong') && <span className="text-orange-600 flex items-center gap-1"><XCircle size={14} /> {receiptStatus}</span>}
                      {receiptStatus === 'In Use' && <span className="text-red-600 flex items-center gap-1"><XCircle size={14} /> Receipt number {formData.receiptNo} is already in use.</span>}
                      {receiptStatus === 'Available' && <span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={14} /> Available</span>}
                    </div>
                  )}

                  {receiptStatus === 'Available' && gapWarning && formData.receiptNo !== (devotee.receiptNo || devotee.receipt_no) && (
                    <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg mt-2 shadow-sm">
                      <div className="flex gap-2 text-orange-800 font-bold text-sm items-start">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                        <p>Changing {devotee.receiptNo || devotee.receipt_no} to {formData.receiptNo} will create a receipt-number gap.</p>
                      </div>
                      <label className="flex items-center gap-2 mt-3 cursor-pointer">
                        <input type="checkbox" checked={gapConfirmed} onChange={(e) => setGapConfirmed(e.target.checked)} className="w-4 h-4 accent-orange-600" />
                        <span className="text-xs font-bold text-orange-900">I confirm this sequence gap is intentional</span>
                      </label>
                    </div>
                  )}

                  <div className="flex justify-end mt-2 border-t pt-2">
                    <button type="button" onClick={() => { setIsEditingReceipt(false); setFormData({ ...formData, receiptNo: devotee.receiptNo || devotee.receipt_no }); setGapConfirmed(false); }} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg transition-colors">Cancel Edit</button>
                  </div>
                </div>
              )}
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
              <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Phone</label>
              <MaskedPhoneInput value={formData.phone} onChange={(phone) => setFormData({ ...formData, phone })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Total Amount (₹)</label>
              <input type="number" required value={formData.totalAmount} onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Paid Amount (₹)</label>
              <input type="number" required value={formData.paidAmount} onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Item / In-kind</label>
              <input type="text" value={formData.donationItem} onChange={(e) => setFormData({ ...formData, donationItem: e.target.value })} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary outline-none" />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <TeluguInput label="Gotram" value={formData.gotram} onChange={(val) => setFormData({ ...formData, gotram: val })} />
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
