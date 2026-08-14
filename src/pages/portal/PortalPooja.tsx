import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Search } from 'lucide-react';
import { usePortalStore } from '../../store/portalStore';
import { useAppStore } from '../../store/appStore';
import { subscribeToSlots, bookPoojaSlot, getFestivalStartDate } from '../../lib/pooja-service';
import { PoojaSlot, PoojaBookingData } from '../../types/pooja';
import SlotCard from '../../components/pooja/SlotCard';
import BookingModal from '../../components/pooja/BookingModal';
import { toast } from 'react-hot-toast';
import { createAdminNotification } from '../../lib/notifications';
import { supabase } from '../../lib/supabase';

export function PortalPooja() {
  const { settings } = usePortalStore();
  const { currentYear } = useAppStore();
  const [slots, setSlots] = useState<PoojaSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<PoojaSlot | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [festivalStartDate, setFestivalStartDate] = useState<string | null>(null);

  // Receipt Verification State
  const [verifiedReceipt, setVerifiedReceipt] = useState<string | null>(null);
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [receiptInput, setReceiptInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [receiptError, setReceiptError] = useState("");

  useEffect(() => {
    const fetchConfig = async () => {
      const date = await getFestivalStartDate();
      setFestivalStartDate(date);
    };
    fetchConfig();

    const unsubscribe = subscribeToSlots(currentYear, (updatedSlots) => {
      setSlots(updatedSlots);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentYear]);

  const handleVerifyReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedReceipt = receiptInput.trim().toUpperCase();
    const normalizedInputName = nameInput.trim().replace(/\s+/g, ' ').toLowerCase();

    if (!trimmedReceipt || !normalizedInputName) {
      setReceiptError("Please enter both receipt number and name.");
      return;
    }
    setVerifying(true);
    setReceiptError("");
    
    try {
      const { data, error } = await supabase
        .from('devotees')
        .select('receipt_no, name, phone')
        .eq('receipt_no', trimmedReceipt)
        .maybeSingle();

      if (error) throw error;
      if (data && data.receipt_no && data.name) {
        const dbNameNormalized = data.name.trim().replace(/\s+/g, ' ').toLowerCase();
        if (dbNameNormalized === normalizedInputName) {
            setVerifiedReceipt(data.receipt_no);
            setVerifiedName(data.name);
            if (data.phone) {
               setVerifiedPhone(data.phone);
            }
        } else {
            setReceiptError("Receipt holder name does not match this receipt.");
        }
      } else {
        setReceiptError("Receipt number not found. Please check your receipt number.");
      }
    } catch (err: any) {
      console.error(err);
      setReceiptError("Error verifying receipt. Please try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleBook = async (slotId: string, data: PoojaBookingData) => {
    setIsSubmitting(true);
    const bookingDataWithReceipt = { ...data, receipt_no: verifiedReceipt || undefined };
    const result = await bookPoojaSlot(slotId, bookingDataWithReceipt, currentYear);
    setIsSubmitting(false);
    
    if (result.success) {
      toast.success("✨ Your pooja slot has been booked successfully!");
      
      await createAdminNotification({
        actorName: data.name || 'Unknown',
        type: 'QR PORTAL · POOJA BOOKING',
        message: `${data.name || 'Unknown'} (Receipt: ${verifiedReceipt}) booked Pooja.`
      });

      setSelectedSlot(null);
    } else {
      toast.error(`Error: ${result.error || "Failed to book"}`);
    }
  };

  const days = useMemo(() => {
    const grouped: Record<number, { morning?: PoojaSlot, evening?: PoojaSlot }> = {};
    slots.forEach(slot => {
        if (!grouped[slot.day]) grouped[slot.day] = {};
        if (slot.time === 'morning') grouped[slot.day].morning = slot;
        if (slot.time === 'evening') grouped[slot.day].evening = slot;
    });
    return Object.entries(grouped)
      .filter(([day]) => Number(day) <= 8)
      .sort((a,b) => Number(a[0]) - Number(b[0]));
  }, [slots]);

  const currentFestivalDay = useMemo(() => {
    if (!festivalStartDate) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(festivalStartDate);
    start.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - start.getTime();
    return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }, [festivalStartDate]);

  if (!settings?.enable_pooja) return null;

  if (!verifiedReceipt) {
    return (
      <div className="bg-white/80 backdrop-blur-md rounded-3xl p-4 sm:p-6 shadow-xl border border-white">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/portal" className="p-2 rounded-full hover:bg-purple-50 text-gray-500 hover:text-purple-600 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <h2 className="text-xl font-bold text-gray-800">Book Pooja</h2>
        </div>

        <form onSubmit={handleVerifyReceipt} className="space-y-6 max-w-md mx-auto py-8">
            <p className="text-sm text-gray-600 font-medium text-center">
              Enter your Chanda receipt details to continue.
            </p>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Receipt Number</label>
              <input
                type="text"
                required
                value={receiptInput}
                onChange={(e) => setReceiptInput(e.target.value)}
                placeholder="G26-001"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all shadow-sm font-mono tracking-wider"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Receipt Holder Name</label>
              <input
                type="text"
                required
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="Enter name"
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none transition-all shadow-sm font-medium"
              />
            </div>

            {receiptError && (
              <div className="p-4 bg-red-50 text-red-600 text-sm font-bold rounded-xl border border-red-100 text-center animate-in fade-in zoom-in-95">
                {receiptError}
              </div>
            )}

            <button
              type="submit"
              disabled={verifying}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-xl shadow-lg text-white font-bold text-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-70"
            >
              {verifying ? <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" /> : "Continue"}
            </button>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-3xl p-4 sm:p-6 shadow-xl border border-white">
      <div className="flex items-center gap-3 mb-6">
        <button 
          onClick={() => {
            setVerifiedReceipt(null);
            setVerifiedName(null);
            setVerifiedPhone(null);
          }} 
          className="p-2 rounded-full hover:bg-purple-50 text-gray-500 hover:text-purple-600 transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="text-xl font-bold text-gray-800">Book Pooja</h2>
      </div>
      
      <div className="mb-6 bg-purple-50 p-4 rounded-xl border border-purple-100 flex justify-between items-center">
         <div>
            <p className="text-xs font-bold text-purple-600 uppercase tracking-widest">Verified Receipt</p>
            <p className="text-lg font-black text-gray-800 font-mono">{verifiedReceipt}</p>
         </div>
         <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
             <span className="text-green-500 font-bold">✓</span>
         </div>
      </div>

      <div className="space-y-6">
        {loading ? (
            <div className="flex justify-center items-center py-20">
                <RefreshCw className="animate-spin text-purple-500 w-8 h-8" />
            </div>
        ) : days.length > 0 ? (
            <div className="grid grid-cols-1 gap-6">
                {days.map(([day, slotsObj]) => {
                    const dayNum = Number(day);
                    const isPastDay = festivalStartDate ? dayNum < currentFestivalDay : false;
                    const isToday = festivalStartDate ? dayNum === currentFestivalDay : false;
                    const currentHour = new Date().getHours();
                    
                    const isMorningPast = isPastDay || (isToday && currentHour >= 9);
                    const isEveningPast = isPastDay || (isToday && currentHour >= 20);

                    return (
                    <SlotCard 
                        key={day}
                        day={dayNum}
                        morningSlot={slotsObj.morning}
                        eveningSlot={slotsObj.evening}
                        onBook={setSelectedSlot}
                        isAdmin={false}
                        isPublicPortal={true}
                        onCancelFamily={() => {}}
                        onShareFamily={() => {}}
                        onReminderFamily={() => {}}
                        isToday={isToday}
                        isMorningPast={isMorningPast}
                        isEveningPast={isEveningPast}
                        festivalStartDate={festivalStartDate}
                    />
                    );
                })}
            </div>
        ) : (
            <div className="text-center py-12 text-gray-500 font-medium">
                Pooja calendar is not yet available. Please check back later.
            </div>
        )}
      </div>

      <BookingModal 
        slot={selectedSlot}
        onClose={() => setSelectedSlot(null)}
        onBook={handleBook}
        isSubmitting={isSubmitting}
        verifiedName={verifiedName}
        verifiedPhone={verifiedPhone}
      />
    </div>
  );
}
