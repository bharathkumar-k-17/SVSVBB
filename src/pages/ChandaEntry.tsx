import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { useAuthStore } from '../store/authStore';
import { addDoc, collection, doc, getDoc, getDocs, query, where, setDoc, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { QrCode, CreditCard, Banknote, Save, HeartHandshake, Crown, X } from 'lucide-react';
import { Receipt } from '../components/Receipt';
import { QRCodeSVG } from 'qrcode.react';
import { TeluguInput } from '../components/TeluguInput';
import { format } from 'date-fns';
import { MaskedPhoneInput } from '../components/MaskedPhoneInput';
import { createAdminNotification } from '../lib/notifications';
import { maskPhoneNumber, normalizePhoneDigits } from '../lib/privacy';

export function ChandaEntry() {
  const { currentYear, devotees } = useAppStore();
  const { appUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [lastSavedDevotee, setLastSavedDevotee] = useState<any>(null);
  const [upiId, setUpiId] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'app'));
        if (snap.exists() && snap.data().upiId) {
          setUpiId(snap.data().upiId);
        }
      } catch (err) {}
    };
    fetchSettings();
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    totalAmount: '',
    paidAmount: '',
    donationItem: '',
    paymentMode: 'Cash' as 'Cash' | 'UPI',
    gotram: '',
    familyMembersStr: '',
    date: format(new Date(), 'yyyy-MM-dd')
  });

  const totalAmtNum = Number(formData.totalAmount) || 0;
  const isVip = totalAmtNum >= 1000 || formData.donationItem.trim().length > 0;
  const isAdmin = appUser?.role === 'admin' || appUser?.role === 'super_admin';
  const isCurrentDay = (timestamp?: number) => {
    if (!timestamp) return false;
    const date = new Date(timestamp);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };
  const todaysCollections = devotees.filter(
    (devotee) => isCurrentDay(devotee.createdAt) && (isAdmin || devotee.volunteerId === appUser?.uid),
  );



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser) return;
    if (normalizePhoneDigits(formData.phone).length !== 10) {
      alert('Enter a valid 10-digit phone number.');
      return;
    }
    setLoading(true);
    setSuccess(false);

    try {
      const now = Date.now();
      
      const yy = format(now, 'yy');
      const mm = format(now, 'MM');
      const dd = format(now, 'dd');
      const dateStr = `${yy}${mm}${dd}`;
      const counterRef = doc(db, 'counters', `receipt_${dateStr}`);
      let currentCount = 1;

      try {
        await runTransaction(db, async (transaction) => {
          const counterDoc = await transaction.get(counterRef);
          if (!counterDoc.exists()) {
            transaction.set(counterRef, { count: 1 });
            currentCount = 1;
          } else {
            currentCount = counterDoc.data().count + 1;
            transaction.update(counterRef, { count: currentCount });
          }
        });
      } catch (txnError) {
        console.error("Transaction failed: ", txnError);
        throw new Error("Ensure device is online to generate secure tracking ID.");
      }

      const paddedCount = currentCount.toString().padStart(3, '0');
      const receiptNo = `G${dateStr}${paddedCount}`;

      const tAmt = Number(formData.totalAmount) || 0;
      const pAmt = Number(formData.paidAmount) || 0;
      const pending = tAmt - pAmt;
      const status = pending === 0 ? 'PAID' : (pAmt > 0 ? 'PARTIAL' : 'UNPAID');

      const devoteeData = {
        name: formData.name,
        phone: normalizePhoneDigits(formData.phone),
        totalAmount: tAmt,
        paidAmount: pAmt,
        pendingAmount: pending,
        donationItem: formData.donationItem,
        paymentMode: formData.paymentMode,
        paymentStatus: status,
        gotram: isVip ? formData.gotram : '',
        familyMembers: isVip ? formData.familyMembersStr.split(',').map(s => s.trim()).filter(Boolean) : [],
        year: currentYear,
        volunteerId: appUser.uid || 'admin',
        volunteerName: appUser.name || 'Admin',
        volunteerPhone: appUser.phone || '',
        createdAt: formData.date ? new Date(formData.date).getTime() : now,
        receiptNo
      };

      const docRef = doc(collection(db, 'devotees'));
      await setDoc(docRef, devoteeData);
      await createAdminNotification({ actor: appUser, type: 'chanda', amount: pAmt });
      
      // Save initial payment
      if (pAmt > 0) {
        addDoc(collection(db, 'payments'), {
          devoteeId: docRef.id,
          amount: pAmt,
          mode: formData.paymentMode,
          date: now,
          volunteerId: appUser.uid || 'admin',
          volunteerName: appUser.name || 'Admin',
          year: currentYear
        }).catch((err: any) => console.warn(err));
      }

      const savedDevotee = { id: docRef.id, ...devoteeData };
      setLastSavedDevotee(savedDevotee);
      setSuccess(true);

      // ── Auto-add to VIP Gothram list if amount >= 1000 and gotram is provided ──
      if (tAmt >= 1000 && isVip && formData.gotram.trim()) {
        try {
          // Check for duplicate gotram (case-insensitive)
          getDocs(
            query(
              collection(db, 'vipGotrams'),
              where('year', '==', currentYear)
            )
          ).then(vipSnap => {
             const maxOrder = vipSnap.docs.reduce((max, d) => Math.max(max, d.data().order ?? 0), 0);
             addDoc(collection(db, 'vipGotrams'), {
               gotram: formData.gotram.trim(),
               familyMembers: formData.familyMembersStr.split(',').map(s => s.trim()).filter(Boolean),
               order: maxOrder + 1,
               source: 'Chanda',
               devoteeId: docRef.id,
               year: currentYear,
               createdAt: now
             });
          });
        } catch (vipErr) {
          console.warn('VIP auto-add failed (non-critical):', vipErr);
        }
      }
      
      setFormData({
        name: '',
        phone: '',
        totalAmount: '',
        paidAmount: '',
        donationItem: '',
        paymentMode: 'Cash',
        gotram: '',
        familyMembersStr: '',
        date: format(new Date(), 'yyyy-MM-dd')
      });

    } catch (error: any) {
      console.error("Error adding devotee: ", error);
      alert(`Failed to save entry: ${error.message || 'Unknown error'}. Please check your internet connection.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      {/* Form Section */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-orange-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <HeartHandshake className="text-primary" />
          Chanda Collection {currentYear}
        </h2>

        {success && lastSavedDevotee && (
          <div className="mb-6 animate-in fade-in slide-in-from-top-2">
            <div className="p-4 bg-green-50 text-green-800 rounded-lg flex flex-col gap-3 items-center border border-green-200 shadow-sm mb-6">
              <span className="font-bold flex items-center gap-2 text-lg">✅ Chanda Entry Saved Successfully!</span>
              <p className="text-sm">Please see the generated receipt below. You can print or share it using the buttons provided.</p>
            </div>
            
            <div className="w-full">
              <Receipt 
                data={lastSavedDevotee} 
                isBlank={false}
              />
            </div>
            
            <button
               onClick={() => {
                 setSuccess(false);
                 setLastSavedDevotee(null);
                 setFormData({ name: '', phone: '', totalAmount: '', paidAmount: '', donationItem: '', paymentMode: 'Cash', gotram: '', familyMembersStr: '', date: format(new Date(), 'yyyy-MM-dd') });
               }}
               className="mt-6 w-full flex items-center justify-center gap-2 py-3 border border-gray-300 rounded-xl shadow-sm bg-white font-bold text-gray-700 hover:bg-gray-50"
            >
              Add Another Devotee
            </button>
          </div>
        )}

        {!success && (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Transaction Date</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={(e) => setFormData({...formData, date: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm outline-none text-base font-medium"
                />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm outline-none text-base"
                  placeholder=""
                  autoComplete="name"
                />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Mobile Number</label>
                <MaskedPhoneInput
                  required
                  value={formData.phone}
                  onChange={(phone) => setFormData({...formData, phone})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm outline-none text-base"
                />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Total Amount (₹)</label>
                <input
                  type="number"
                  required
                  min="0"
                  inputMode="numeric"
                  value={formData.totalAmount}
                  onChange={(e) => setFormData({...formData, totalAmount: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm outline-none font-bold text-gray-900 text-base"
                  placeholder=""
                />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Paid Amount (₹)</label>
                <input
                  type="number"
                  required
                  min="0"
                  max={formData.totalAmount || "0"}
                  inputMode="numeric"
                  value={formData.paidAmount}
                  onChange={(e) => setFormData({...formData, paidAmount: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm outline-none font-bold text-green-700 text-base"
                  placeholder=""
                />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Items/In-kind Donation</label>
                <input
                  type="text"
                  value={formData.donationItem}
                  onChange={(e) => setFormData({...formData, donationItem: e.target.value})}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all shadow-sm outline-none font-medium text-orange-600 text-base"
                  placeholder=""
                />
            </div>
          </div>

          <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
            <label className="block text-sm font-semibold text-gray-900 mb-3">Payment Status & Mode</label>
            <div className="flex gap-4 mb-4">
               {/* Amount Status display logic */}
               <div className="flex-1 font-bold text-sm bg-white p-3 rounded border border-orange-200 flex justify-between">
                 Pending Amount: 
                 <span className="text-red-500">₹{(Number(formData.totalAmount || 0) - Number(formData.paidAmount || 0)).toLocaleString()}</span>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className={`flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer transition-all ${formData.paymentMode === 'Cash' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                <input
                  type="radio"
                  name="paymentMode"
                  value="Cash"
                  checked={formData.paymentMode === 'Cash'}
                  onChange={() => setFormData({...formData, paymentMode: 'Cash'})}
                  className="hidden"
                />
                <Banknote className="mr-2" size={20} />
                <span className="font-bold">Cash</span>
              </label>

              <label className={`flex items-center justify-center p-3 border-2 rounded-xl cursor-pointer transition-all ${formData.paymentMode === 'UPI' ? 'border-primary bg-primary/10 text-primary' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                <input
                  type="radio"
                  name="paymentMode"
                  value="UPI"
                  checked={formData.paymentMode === 'UPI'}
                  onChange={() => setFormData({...formData, paymentMode: 'UPI'})}
                  className="hidden"
                />
                <QrCode className="mr-2" size={20} />
                <span className="font-bold">UPI</span>
              </label>
            </div>
            
            {formData.paymentMode === 'UPI' && (
              <div className="mt-4 p-5 bg-white border border-orange-200 rounded-xl flex flex-col items-center justify-center text-center">
                {upiId ? (() => {
                  const numAmt = Number(formData.paidAmount) || 0;
                  const upiUrl = `upi://pay?pa=${upiId}&pn=SVSVBB&am=${numAmt > 0 ? numAmt : ''}&cu=INR`;
                  return (
                    <>
                       <div className="bg-white p-3 rounded-2xl shadow-sm border border-orange-100 mb-4 inline-block">
                         <QRCodeSVG value={upiUrl} size={150} level="M" />
                       </div>
                       <div className="w-full bg-orange-50 rounded-lg p-3 text-sm text-gray-700 border border-orange-100/50 shadow-sm text-left">
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
                    </>
                  );
                })() : (
                  <p className="text-gray-500 text-sm font-medium">UPI ID is not configured in settings. Please contact admin.</p>
                )}
              </div>
            )}
          </div>

          {/* VIP Section Content */}
          {isVip && (
             <div className="bg-yellow-50 rounded-xl p-5 border border-yellow-200 shadow-inner">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-yellow-800 flex items-center gap-2">
                    <Crown size={20} /> VIP Gotram Slot unlocked!
                  </h3>
               </div>
               
               <div className="mb-4">
                  <TeluguInput
                    label="Gotram Name"
                    value={formData.gotram}
                    onChange={(val) => setFormData({...formData, gotram: val})}
                    placeholder=""
                  />
               </div>

                   <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-semibold text-gray-700">Family Members (Comma separated)</label>
                      </div>
                      <TeluguInput
                        value={formData.familyMembersStr}
                        onChange={(val) => setFormData({...formData, familyMembersStr: val})}
                        placeholder="name1, name2, name3..."
                      />
                   </div>
             </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-4 border border-transparent rounded-xl shadow-md text-white font-bold text-lg bg-gradient-to-r from-primary to-orange-500 hover:from-orange-600 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
               <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></span>
             ) : (
                <> <Save size={24} /> Save & Share </>
             )}
          </button>
        </form>
        )}
      </div>

      {/* Current Day Collections */}
      <div className="mt-8 bg-white/50 backdrop-blur-xl rounded-2xl shadow-lg border border-white/60 overflow-hidden relative">
        <div className="px-6 py-4 border-b border-white/40 flex justify-between items-center bg-white/30 backdrop-blur-sm">
          <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
            <HeartHandshake size={20} className="text-primary" />
            Today's Collections
          </h3>
          <span className="text-xs font-bold text-gray-500 bg-white/50 px-3 py-1 rounded-full border border-white/60 shadow-sm">
            {todaysCollections.length} Today
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/40">
            <thead className="bg-white/30">
              <tr>
                <th className="px-6 py-3 text-center text-xs font-black text-gray-500 uppercase tracking-wider">S.No</th>
                <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-black text-gray-500 uppercase tracking-wider">Devotee</th>
                <th className="px-6 py-3 text-center text-xs font-black text-gray-500 uppercase tracking-wider">Cash/UPI</th>
                <th className="px-6 py-3 text-right text-xs font-black text-gray-500 uppercase tracking-wider">Amount Paid</th>
                <th className="px-6 py-3 text-center text-xs font-black text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/20 bg-white/10">
              {todaysCollections
                .map((dev, idx) => (
                  <tr key={dev.id} className="hover:bg-white/40 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-center text-xs font-bold text-gray-500">
                      {idx + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-600">
                      {format(dev.createdAt, 'dd MMM, HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-black text-gray-900">{dev.name}</div>
                      <div className="text-[10px] font-bold text-gray-500">{maskPhoneNumber(dev.phone)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-block text-[10px] font-black px-2 py-0.5 rounded border ${
                        dev.paymentMode === 'UPI' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {dev.paymentMode || 'Cash'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-black text-emerald-700">₹{(dev.paidAmount || 0).toLocaleString()}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`inline-block text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        dev.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                        dev.paymentStatus === 'PARTIAL' ? 'bg-amber-100 text-amber-800' :
                        'bg-rose-100 text-rose-800'
                      }`}>
                        {dev.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              {todaysCollections.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500 font-bold text-sm bg-white/20">
                    ✨ No collections recorded yet. Start by adding one above! ✨
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
