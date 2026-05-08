import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { doc, updateDoc, addDoc, collection, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { X, CreditCard, Banknote, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface PaymentModalProps {
  devotee: any;
  onClose: () => void;
}

export function PaymentModal({ devotee, onClose }: PaymentModalProps) {
  const { appUser } = useAuthStore();
  const { currentYear } = useAppStore();
  const [amount, setAmount] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [mode, setMode] = useState<'Cash' | 'UPI'>('Cash');
  const [loading, setLoading] = useState(false);
  const [upiId, setUpiId] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'app'));
        if (snap.exists() && snap.data().upiId) {
          setUpiId(snap.data().upiId);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser) return;
    
    const numAmt = Number(amount);
    if (!numAmt || numAmt <= 0) return;
    if (numAmt > devotee.pendingAmount) {
      alert("Amount cannot be greater than pending amount");
      return;
    }

    setLoading(true);

    try {
      const now = Date.now();
      
      // Add payment history
      await addDoc(collection(db, 'payments'), {
        devoteeId: devotee.id,
        amount: numAmt,
        mode,
        transactionId: mode === 'UPI' ? transactionId : null,
        date: now,
        volunteerId: appUser.uid || 'admin',
        volunteerName: appUser.name || 'Admin',
        year: currentYear
      });

      // Update devotee status
      const newPaid = devotee.paidAmount + numAmt;
      const newPending = devotee.totalAmount - newPaid;
      const status = newPending === 0 ? 'PAID' : (newPaid > 0 ? 'PARTIAL' : 'UNPAID');

      await updateDoc(doc(db, 'devotees', devotee.id), {
        paidAmount: newPaid,
        pendingAmount: newPending,
        paymentStatus: status,
        paymentMode: mode
      });

      onClose();
    } catch (err: any) {
      console.error(err);
      alert(`Failed to add payment: ${err.message || 'Unknown error'}. Try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-gray-50/80">
          <h2 className="text-xl font-bold text-gray-900">Add Payment</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6 bg-orange-50 p-4 rounded-xl border border-orange-100 flex justify-between items-center">
             <div>
                <p className="text-sm text-gray-500 font-medium">Devotee Name</p>
                <p className="font-bold text-gray-900">{devotee.name}</p>
             </div>
             <div className="text-right">
                <p className="text-sm text-gray-500 font-medium">Pending Amount</p>
                <p className="font-bold text-red-500 text-lg">₹{devotee.pendingAmount}</p>
             </div>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">New Amount (₹)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <CreditCard className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="number"
                  required
                  min="1"
                  max={devotee.pendingAmount}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm outline-none font-bold text-gray-900 text-lg"
                  placeholder=""
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Payment Mode</label>
              <div className="grid grid-cols-2 gap-3">
                <label className={`flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer transition-all ${mode === 'Cash' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600'}`}>
                  <input
                    type="radio"
                    name="mode"
                    value="Cash"
                    checked={mode === 'Cash'}
                    onChange={() => setMode('Cash')}
                    className="hidden"
                  />
                  <Banknote className="mr-2 h-5 w-5" />
                  <span className="font-bold">Cash</span>
                </label>

                <label className={`flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer transition-all ${mode === 'UPI' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-600'}`}>
                  <input
                    type="radio"
                    name="mode"
                    value="UPI"
                    checked={mode === 'UPI'}
                    onChange={() => setMode('UPI')}
                    className="hidden"
                  />
                  <QrCode className="mr-2 h-5 w-5" />
                  <span className="font-bold">UPI</span>
                </label>
              </div>
            </div>
            
            {mode === 'UPI' && (
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 flex flex-col items-center justify-center text-center">
                {upiId ? (() => {
                  const numAmt = Number(amount) || 0;
                  const upiUrl = `upi://pay?pa=${upiId}&pn=SVSVBB&am=${numAmt > 0 ? numAmt : ''}&cu=INR`;
                  return (
                    <>
                       <div className="bg-white p-3 rounded-2xl shadow-sm border border-orange-100 mb-4 inline-block">
                         <QRCodeSVG value={upiUrl} size={150} level="M" />
                       </div>
                       <div className="w-full bg-white rounded-lg p-3 text-sm text-gray-700 border border-orange-100 shadow-sm text-left">
                         <div className="flex justify-between items-center mb-1">
                           <span className="text-gray-500 font-medium text-xs">UPI ID</span>
                           <span className="font-bold">{upiId}</span>
                         </div>
                         <div className="flex justify-between items-center">
                           <span className="text-gray-500 font-medium text-xs">Amount</span>
                           <span className="font-bold text-red-600">₹{numAmt}</span>
                         </div>
                       </div>
                       <p className="text-xs text-orange-600 font-semibold mt-3 bg-white/50 py-1 px-3 rounded-full border border-orange-200">
                         Scan to pay securely via UPI
                       </p>
                       <div className="w-full mt-4 text-left">
                         <label className="block text-sm font-semibold text-gray-700 mb-1">Transaction ID (Optional)</label>
                         <input
                           type="text"
                           value={transactionId}
                           onChange={(e) => setTransactionId(e.target.value)}
                           className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all text-sm outline-none"
                           placeholder=""
                         />
                       </div>
                    </>
                  );
                })() : (
                  <p className="text-gray-500 text-sm font-medium">UPI ID is not configured in settings. Please contact admin.</p>
                )}
              </div>
            )}
          </div>

          <div className="mt-8 pt-4 border-t border-gray-100 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-gray-700 font-bold hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !amount || Number(amount) <= 0}
              className="flex-1 py-3 px-4 border border-transparent rounded-xl shadow-sm text-white font-bold bg-gradient-to-r from-primary to-orange-500 hover:from-orange-600 hover:to-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Payment Done'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
