import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { usePortalStore } from '../../store/portalStore';
import { useAppStore } from '../../store/appStore';
import { subscribeToSlots, bookPoojaSlot, getFestivalStartDate } from '../../lib/pooja-service';
import { PoojaSlot, PoojaBookingData } from '../../types/pooja';
import SlotCard from '../../components/pooja/SlotCard';
import BookingModal from '../../components/pooja/BookingModal';
import { toast } from 'react-hot-toast';
import { createAdminNotification } from '../../lib/notifications';

export function PortalPooja() {
  const { settings } = usePortalStore();
  const { currentYear } = useAppStore();
  const [slots, setSlots] = useState<PoojaSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<PoojaSlot | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [festivalStartDate, setFestivalStartDate] = useState<string | null>(null);

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

  const handleBook = async (slotId: string, data: PoojaBookingData) => {
    setIsSubmitting(true);
    const result = await bookPoojaSlot(slotId, data, currentYear);
    setIsSubmitting(false);
    
    if (result.success) {
      toast.success("✨ Your pooja slot has been booked successfully!");
      
      await createAdminNotification({
        actorName: data.name || 'Unknown',
        type: 'QR PORTAL · POOJA BOOKING',
        message: `${data.name || 'Unknown'} booked Pooja.`
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

  return (
    <div className="bg-white/80 backdrop-blur-md rounded-3xl p-4 sm:p-6 shadow-xl border border-white">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/portal" className="p-2 rounded-full hover:bg-purple-50 text-gray-500 hover:text-purple-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h2 className="text-xl font-bold text-gray-800">Book Pooja</h2>
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
      />
    </div>
  );
}
