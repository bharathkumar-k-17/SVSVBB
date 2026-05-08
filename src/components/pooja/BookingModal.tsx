import React, { useState } from 'react';
import { PoojaSlot, PoojaBookingData } from '../../types/pooja';
import { MaskedPhoneInput } from '../MaskedPhoneInput';
import { normalizePhoneDigits } from '../../lib/privacy';
import { X } from 'lucide-react';

interface BookingModalProps {
  slot: PoojaSlot | null;
  onClose: () => void;
  onBook: (slotId: string, data: PoojaBookingData) => Promise<void>;
  isSubmitting: boolean;
}

const BookingModal: React.FC<BookingModalProps> = ({ slot, onClose, onBook, isSubmitting }) => {
  const [formData, setFormData] = useState<PoojaBookingData>({
    name: '',
    phone: '',
  });
  const [error, setError] = useState<string | null>(null);

  if (!slot) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || normalizePhoneDigits(formData.phone).length !== 10) {
      setError("Please fill all required fields!");
      return;
    }
    setError(null);
    await onBook(slot.id, { ...formData, phone: normalizePhoneDigits(formData.phone) });
    setFormData({ name: '', phone: '' });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={onClose}></div>
      
      <div className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        {/* Header */}
        <div className="relative h-32 bg-orange-600 flex items-end px-8 pb-6 overflow-hidden">
             {/* Pattern Overlay */}
             <div className="absolute inset-0 opacity-10 pointer-events-none">
                 {[...Array(12)].map((_, i) => (
                    <div key={i} className="absolute w-24 h-24 border-2 border-white rounded-full -m-12" style={{ top: `${Math.random()*100}%`, left: `${Math.random()*100}%` }}></div>
                 ))}
             </div>
             
             <div className="relative z-10 w-full flex justify-between items-center">
                <h2 className="text-2xl font-black text-white flex items-center gap-3">
                    <span className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shadow-inner">🕉️</span>
                    Pooja Booking
                </h2>
                <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
                    <X size={24} />
                </button>
             </div>
        </div>

        <div className="p-8 space-y-6">
            <div className="bg-orange-50/50 p-5 rounded-3xl border border-orange-100 flex items-center justify-between">
                <div>
                     <p className="text-[10px] text-orange-600 font-black uppercase tracking-[0.2em] mb-1">Reservation For</p>
                     <p className="text-xl font-black text-gray-800 tracking-tight">Day {slot.day} - {slot.time === 'morning' ? 'Morning' : 'Evening'}</p>
                </div>
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-md border border-orange-100">
                    <span className="text-orange-500 text-xl font-bold">✨</span>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Family Last Name / Gotram</label>
                    <input 
                        type="text" 
                        required
                        className="w-full h-14 bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 focus:outline-none focus:border-orange-500 focus:bg-white transition-all text-gray-800 font-bold placeholder:text-gray-300"
                        placeholder=""
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest ml-1">WhatsApp Number</label>
                    <MaskedPhoneInput
                        required
                        className="w-full h-14 bg-gray-50 border-2 border-gray-100 rounded-2xl px-5 focus:outline-none focus:border-orange-500 focus:bg-white transition-all text-gray-800 font-bold placeholder:text-gray-300"
                        value={formData.phone}
                        onChange={(phone) => setFormData({...formData, phone})}
                    />
                    <p className="text-[10px] text-gray-400 font-bold italic px-1">Reminders will be sent to this number.</p>
                </div>

                {error && (
                    <div className="bg-red-50 p-3 rounded-xl border border-red-100 text-red-600 text-xs font-bold text-center">
                        {error}
                    </div>
                )}

                <div className="flex gap-4 pt-4">
                    <button 
                        type="submit" 
                        disabled={isSubmitting}
                        className={`
                            w-full h-16 rounded-[2rem] font-black uppercase tracking-[0.2em] text-[11px] shadow-2xl transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3
                            ${isSubmitting 
                                ? 'bg-gray-100 text-gray-400' 
                                : 'bg-gradient-to-r from-orange-600 via-orange-500 to-orange-600 bg-[length:200%_auto] hover:bg-right text-white shadow-orange-500/40'
                            }
                        `}
                    >
                        {isSubmitting ? (
                            <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                <span>Confirm & Share Divine Booking</span>
                                <span className="text-xl">✨</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
      </div>
    </div>
  );
};

export default BookingModal;
