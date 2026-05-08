import React from 'react';
import { PoojaSlot, PoojaFamilyBooking } from '../../types/pooja';
import { BellRing, MessageCircle, Phone, PlusCircle, Trash2, UserPlus, Zap } from 'lucide-react';
import { maskPhoneNumber } from '../../lib/privacy';

interface SlotCardProps {
  day: number;
  morningSlot?: PoojaSlot;
  eveningSlot?: PoojaSlot;
  onBook: (slot: PoojaSlot) => void;
  isAdmin: boolean;
  onCancelFamily: (slotId: string, familyId: string) => void;
  onShareFamily: (slot: PoojaSlot, family: PoojaFamilyBooking) => void;
  onReminderFamily: (slot: PoojaSlot, family: PoojaFamilyBooking) => void;
  isToday?: boolean;
  isMorningPast?: boolean;
  isEveningPast?: boolean;
  festivalStartDate?: string | null;
}

const SlotCard: React.FC<SlotCardProps> = ({ 
  day, morningSlot, eveningSlot, onBook, isAdmin, onCancelFamily, onShareFamily, onReminderFamily, isToday, isMorningPast, isEveningPast, festivalStartDate 
}) => {

  const calculateDate = (festivalDay: number) => {
    if (!festivalStartDate) return null;
    const start = new Date(festivalStartDate);
    start.setDate(start.getDate() + (festivalDay - 1));
    return start.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const slotDate = calculateDate(day);

  const SlotButton = ({ slot, timeLabel, isEvening, isPastSlot }: { slot?: PoojaSlot, timeLabel: string, isEvening?: boolean, isPastSlot?: boolean }) => {
    if (!slot) return null;
    const activeFamilies = (slot.families || []).filter(f => f.status === 'active');
    const isBooked = activeFamilies.length > 0;

    return (
      <div className="relative group/slot w-full">
        <div className={`
          w-full p-4 rounded-[2rem] transition-all duration-500 border-2 relative overflow-hidden shadow-xl
          ${isPastSlot 
            ? 'bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 shadow-none'
            : isBooked 
              ? 'bg-gradient-to-br from-red-600 to-red-700 border-red-400 shadow-red-500/20' 
              : 'bg-gradient-to-br from-emerald-500 to-emerald-600 border-emerald-400 shadow-emerald-500/20'
          }
        `}>
          {/* Header */}
          <div className="flex justify-between items-center mb-3 relative z-10">
            <div className="flex flex-col">
                <span className={`text-[9px] font-black uppercase tracking-[0.2em] text-white shadow-sm`}>
                {timeLabel}
                </span>
            </div>
            {isBooked && (
                <div className="bg-white/20 backdrop-blur-md text-white text-[8px] font-black px-2 py-0.5 rounded-full border border-white/30 flex items-center gap-1">
                    <Zap size={8} className="fill-current" /> {activeFamilies.length} FAMILIES
                </div>
            )}
          </div>
          
          <div className="space-y-2 relative z-10">
            {isBooked ? (
              activeFamilies.map((family) => (
                <div key={family.id} className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20 group/family hover:bg-white/20 transition-all duration-300">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[12px] font-black text-white tracking-tight uppercase">{family.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="w-1 h-1 bg-white rounded-full"></span>
                          <p className="text-[9px] font-bold text-white/80">{maskPhoneNumber(family.phone)}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {!isPastSlot && (
                        <>
                        <a 
                          href={`tel:${family.phone}`}
                          className="w-7 h-7 bg-white/20 text-white rounded-xl flex items-center justify-center hover:bg-white hover:text-red-600 transition-all border border-white/30"
                          title="Call"
                        >
                          <Phone size={12} fill="currentColor" />
                        </a>
                        <button 
                          onClick={() => onReminderFamily(slot, family)}
                          className="w-7 h-7 bg-white/20 text-white rounded-xl flex items-center justify-center hover:bg-white hover:text-rose-600 transition-all border border-white/30"
                          title="Send Reminder"
                        >
                          <BellRing size={12} />
                        </button>
                        <button 
                          onClick={() => onShareFamily(slot, family)}
                          className="w-7 h-7 bg-white/20 text-white rounded-xl flex items-center justify-center hover:bg-white hover:text-emerald-600 transition-all border border-white/30"
                          title="WhatsApp Confirmation"
                        >
                          <MessageCircle size={12} fill="currentColor" />
                        </button>
                        {isAdmin && (
                          <button 
                            onClick={() => onCancelFamily(slot.id, family.id)}
                            className="w-7 h-7 bg-white/20 text-white rounded-xl flex items-center justify-center hover:bg-white hover:text-red-600 transition-all border border-white/30"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center py-4 border-2 border-dashed border-white/30 rounded-2xl bg-white/10 relative overflow-hidden">
                  <p className="text-[8px] font-black text-white tracking-widest uppercase">Available for Booking</p>
              </div>
            )}
          </div>

          <div className="mt-4 flex gap-2 relative z-10">
            {!isPastSlot ? (
              <button
                onClick={() => onBook(slot)}
                className={`
                  flex-1 py-3 px-3 rounded-[1.2rem] transition-all duration-500 font-black text-[9px] uppercase tracking-widest
                  flex items-center justify-center gap-2 shadow-lg active:scale-95 border border-white/20
                  ${isBooked 
                    ? 'bg-white/20 text-white hover:bg-white hover:text-red-600' 
                    : 'bg-white/20 text-white hover:bg-white hover:text-emerald-600'
                  }
                `}
              >
                <UserPlus size={14} className="stroke-[3]" /> 
                {isBooked ? 'Add Family' : 'Book Now'}
              </button>
            ) : (
              <div className="flex-1 py-3 px-3 rounded-[1.2rem] font-black text-[9px] uppercase tracking-widest flex items-center justify-center gap-2 bg-gray-700/50 text-gray-400 border border-gray-600">
                Completed
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`
      relative group flex flex-col gap-5 p-6 rounded-[2.5rem] transition-all duration-700 border-2 shadow-xl overflow-hidden
      bg-gradient-to-br from-pink-50 via-orange-50 to-pink-100 border-orange-200/50 
      ${isToday ? 'ring-4 ring-orange-400/30 scale-[1.02] z-20' : ''}
    `}>
      {/* Decorative Ornaments */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-orange-400/10 blur-[60px] pointer-events-none rounded-full"></div>

      {isToday && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-600 text-white text-[9px] font-black uppercase tracking-[0.3em] px-6 py-1.5 rounded-full shadow-lg z-30 animate-pulse border border-orange-400/50">
          Divine Presence Today
        </div>
      )}
      
      <div className="flex items-center justify-between relative z-10 border-b border-orange-200/30 pb-3">
        <div className="flex items-center gap-4">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-lg font-black bg-orange-600 text-white shadow-lg shadow-orange-900/20`}>
                {day}
            </div>
            <div>
               <h3 className={`text-lg font-black tracking-tighter uppercase text-gray-800`}>Festival Day {day}</h3>
               {slotDate && <p className={`text-[9px] font-black uppercase tracking-[0.2em] text-orange-600`}>{slotDate}</p>}
            </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 relative z-10">
        <SlotButton slot={morningSlot} timeLabel="Sacred Morning" isPastSlot={isMorningPast} />
        <SlotButton slot={eveningSlot} timeLabel="Divine Evening" isEvening isPastSlot={isEveningPast} />
      </div>

      {/* Ganesh Watermark */}
      <div className="absolute bottom-6 right-6 opacity-[0.03] pointer-events-none transform rotate-12 group-hover:rotate-0 transition-transform duration-1000">
         <img src="https://img.icons8.com/color/512/ganesh.png" alt="" className="w-16" />
      </div>
    </div>
  );
};

export default SlotCard;
