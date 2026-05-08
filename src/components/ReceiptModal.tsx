import { X } from 'lucide-react';
import { Receipt } from './Receipt';

export function ReceiptModal({ devotee, currentYear, onClose }: { devotee: any; currentYear: number; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Sheet on mobile, modal on desktop */}
      <div className="relative w-full sm:max-w-[460px] bg-transparent max-h-[96vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 bg-white/90 text-red-600 hover:bg-red-50 p-2 rounded-full shadow-lg transition-colors"
        >
          <X size={20} />
        </button>

        <div className="pt-3 px-3 pb-6">
          <Receipt data={devotee} currentYear={currentYear} isBlank={false} />
        </div>
      </div>
    </div>
  );
}
