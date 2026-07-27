import React, { useEffect, useState, useMemo } from 'react';
import { 
  subscribeToSlots, 
  bookPoojaSlot, 
  cancelFamilyBooking, 
  initializePoojaSlots, 
  getFestivalStartDate,
  updateFestivalStartDate 
} from '../lib/pooja-service';
import { PoojaSlot, PoojaBookingData, PoojaFamilyBooking } from '../types/pooja';
import SlotCard from '../components/pooja/SlotCard';
import BookingModal from '../components/pooja/BookingModal';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';
import { toast } from 'react-hot-toast';
import { buildWhatsAppUrl, maskPhoneNumber } from '../lib/privacy';
import { supabase } from '../lib/supabase';
import { Calendar, CalendarDays, Plus, Settings2 } from 'lucide-react';

const SLOTS_PER_DAY = 18;

const PoojaBooking: React.FC = () => {
  const [slots, setSlots] = useState<PoojaSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<PoojaSlot | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [festivalStartDate, setFestivalStartDate] = useState<string | null>(null);
  const { appUser } = useAuthStore();
  const currentYear = useAppStore(state => state.currentYear);

  const isSuperAdmin = appUser?.role === 'superadmin';
  const isAdmin = appUser?.role === 'admin' || isSuperAdmin;

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
  }, []);

  const handleSetDate = async () => {
    const newDate = window.prompt("Enter Festival Start Date (YYYY-MM-DD):", festivalStartDate || "");
    if (newDate && newDate !== festivalStartDate) {
      try {
        await updateFestivalStartDate(newDate);
        setFestivalStartDate(newDate);
        toast.success("Festival start date updated!");
        // Re-initialize to update slot logic if needed
        if (window.confirm("Re-initialize 9-day calendar with new date?")) {
           await initializePoojaSlots(true);
        }
      } catch (e) {
        toast.error("Failed to update date.");
      }
    }
  };

  const handleBook = async (slotId: string, data: PoojaBookingData) => {
    setIsSubmitting(true);
    const result = await bookPoojaSlot(slotId, data, currentYear);
    setIsSubmitting(false);
    
    if (result.success) {
      toast.success("✨ Family added to slot!");
      
      // Automatically trigger sharing
      if (selectedSlot) {
        const dateStr = calculateDateStr(selectedSlot.day);
        const message = `*SVSVBB Pooja Confirmation*\n\n🙏 Namaste ${data.name} garu,\n\nYour Pooja slot has been confirmed!\n📅 *Date:* ${dateStr}\n⏰ *Time:* ${selectedSlot.time === 'morning' ? '08:00 AM' : '06:00 PM'}\n🚩 *Day:* ${selectedSlot.day}\n\n_Please arrive 15 mins early._`;
        window.open(buildWhatsAppUrl(data.phone, message), '_blank');
      }

      setSelectedSlot(null);
    } else {
      toast.error(`Error: ${result.error || "Failed to book"}`);
    }
  };

  const handleCancelFamily = async (slotId: string, familyId: string) => {
    if (window.confirm("Remove this family from the slot?")) {
        const result = await cancelFamilyBooking(slotId, familyId);
        if (result.success) {
            toast.success("Family booking cancelled.");
        } else {
            toast.error("Failed to cancel.");
        }
    }
  };

  const calculateDateStr = (festivalDay: number) => {
    if (!festivalStartDate) return '-';
    const start = new Date(festivalStartDate);
    start.setDate(start.getDate() + (festivalDay - 1));
    return start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleShareFamily = (slot: PoojaSlot, family: PoojaFamilyBooking) => {
    const dateStr = calculateDateStr(slot.day);
    const message = `*SVSVBB Pooja Confirmation*\n\n🙏 Namaste ${family.name} garu,\n\nYour Pooja slot has been confirmed!\n📅 *Date:* ${dateStr}\n⏰ *Time:* ${slot.time === 'morning' ? '08:00 AM' : '06:00 PM'}\n🚩 *Day:* ${slot.day}\n\n_Please arrive 15 mins early._`;
    window.open(buildWhatsAppUrl(family.phone, message), '_blank');
  };

  const handleReminderFamily = async (slot: PoojaSlot, family: PoojaFamilyBooking) => {
    if (!family || family.status !== 'active') return;

    // Track reminder in Supabase
    await supabase.from('pooja_slots').update({
      last_reminder_sent_at: new Date().toISOString(),
      last_reminder_to: family.name,
    }).eq('id', slot.id);

    const dateStr = calculateDateStr(slot.day);
    const message = `*SVSVBB Pooja Reminder*\n\n🙏 Namaste ${family.name} garu,\n\nThis is a reminder for your Pooja tomorrow!\n📅 *Date:* ${dateStr}\n⏰ *Time:* ${slot.time === 'morning' ? '08:00 AM' : '06:00 PM'}\n\n_See you at the Mandapam!_`;
    
    window.open(buildWhatsAppUrl(family.phone, message), '_blank');
    toast.success(`Reminder sent to ${family.name}`);
  };

  const days = useMemo(() => {
    const grouped: Record<number, { morning?: PoojaSlot, evening?: PoojaSlot }> = {};
    slots.forEach(slot => {
        if (!grouped[slot.day]) grouped[slot.day] = {};
        if (slot.time === 'morning') grouped[slot.day].morning = slot;
        if (slot.time === 'evening') grouped[slot.day].evening = slot;
    });
    // Filter out Day 10+ just in case
    return Object.entries(grouped)
      .filter(([day]) => Number(day) <= 9)
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

  return (
    <div className="min-h-screen bg-[#FFFBF0] pb-20">
      <div className="relative h-72 bg-orange-600 overflow-hidden flex items-center justify-center">
         <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/clean-gray-paper.png')] opacity-20"></div>
         <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-black/30 via-transparent to-black/10"></div>
         
         <div className="absolute top-8 right-8 z-30 flex gap-2">
             {isSuperAdmin && (
                 <button 
                   onClick={handleSetDate}
                   className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-xl border border-white/20 text-white rounded-xl hover:bg-white/20 transition-all font-black uppercase text-[10px] tracking-widest shadow-lg"
                 >
                    <Calendar size={14} /> Set Festival Date
                 </button>
             )}
         </div>

         <div className="text-center z-10 px-6">
             <div className="inline-block px-5 py-2 bg-white/20 backdrop-blur-xl rounded-full text-white text-[10px] font-black uppercase tracking-[0.3em] mb-4 border border-white/30 shadow-2xl">
                 Divine Pooja Reservations
             </div>
             <h1 className="text-5xl md:text-7xl font-black text-white drop-shadow-2xl tracking-tighter mb-4">Ganesh Festival</h1>
             {festivalStartDate ? (
                 <div className="inline-flex items-center gap-3 px-6 py-2 bg-orange-500 text-white font-black rounded-2xl shadow-xl border-2 border-orange-400/50">
                    <CalendarDays size={20} className="text-orange-200" />
                    <span className="text-lg tracking-tight">Starts: {new Date(festivalStartDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                 </div>
             ) : (
                 <p className="text-orange-100 font-bold italic opacity-70">Festival date not configured</p>
             )}
         </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 -mt-12 mb-10 z-20 relative">
          <div className="flex flex-wrap justify-center gap-4">
              <div className="bg-white/90 backdrop-blur-xl px-6 py-4 rounded-[1.8rem] shadow-xl border border-white flex items-center gap-4 group hover:scale-105 transition-transform duration-500">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition-colors">
                      <Plus className="w-5 h-5 text-orange-600 group-hover:text-white" />
                  </div>
                  <div>
                      <span className="text-2xl font-black text-gray-900 block leading-none">{slots.reduce((acc, s) => acc + (s.families?.filter(f => f.status === 'active').length || 0), 0)}</span>
                      <span className="text-[9px] uppercase font-black text-orange-600 tracking-widest">Total Families</span>
                  </div>
              </div>
              <div className="bg-white/90 backdrop-blur-xl px-6 py-4 rounded-[1.8rem] shadow-xl border border-white flex items-center gap-4 group hover:scale-105 transition-transform duration-500">
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                      <CalendarDays className="w-5 h-5 text-emerald-600 group-hover:text-white" />
                  </div>
                  <div>
                      <span className="text-2xl font-black text-gray-900 block leading-none">{slots.filter(s => s.families?.some(f => f.status === 'active')).length}</span>
                      <span className="text-[9px] uppercase font-black text-emerald-600 tracking-widest">Booked Slots</span>
                  </div>
              </div>
          </div>
      </div>

      <div className="max-w-7xl mx-auto px-6">
          {loading ? (
              <div className="flex flex-col items-center justify-center py-40 gap-6">
                  <div className="relative">
                      <div className="w-20 h-20 border-8 border-orange-100 border-t-orange-600 rounded-full animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-2xl animate-pulse">🕉️</span>
                      </div>
                  </div>
                  <p className="font-black text-orange-900 tracking-widest animate-pulse uppercase text-xs">Invoking Sacred Calendar...</p>
              </div>
          ) : days.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
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
                        isAdmin={isAdmin}
                        onCancelFamily={handleCancelFamily}
                        onShareFamily={handleShareFamily}
                        onReminderFamily={handleReminderFamily}
                        isToday={isToday}
                        isMorningPast={isMorningPast}
                        isEveningPast={isEveningPast}
                        festivalStartDate={festivalStartDate}
                      />
                      );
                  })}
              </div>
          ) : (
              <div className="flex flex-col items-center justify-center py-32 text-center bg-white rounded-[4rem] border-4 border-dashed border-orange-100 shadow-2xl mx-4">
                  <div className="w-24 h-24 bg-orange-50 rounded-full flex items-center justify-center text-5xl mb-8 shadow-inner">🗓️</div>
                  <h3 className="text-4xl font-black text-gray-900 mb-4 tracking-tighter">Calendar Not Set</h3>
                  <p className="text-gray-500 max-w-sm mx-auto mb-10 font-bold leading-relaxed">
                      Please set the festival start date using the button in the top right corner to initialize the 9-day pooja calendar.
                  </p>
                  {isAdmin && (
                      <button 
                        onClick={() => initializePoojaSlots()}
                        className="bg-gray-900 hover:bg-black text-white font-black py-6 px-14 rounded-[2.5rem] shadow-2xl shadow-gray-300 transition-all active:scale-95 flex items-center gap-4 uppercase tracking-widest text-sm group"
                      >
                          <span>Initialize 9-Day Pooja</span>
                          <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform" />
                      </button>
                  )}
              </div>
          )}
      </div>

      <BookingModal 
        slot={selectedSlot}
        onClose={() => setSelectedSlot(null)}
        onBook={handleBook}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};

export default PoojaBooking;
