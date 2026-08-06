import { ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useAppLockStore } from '../store/appLockStore';

export function AppLockSetupPopup() {
  const { supabaseUser } = useAuthStore();
  const { showSetupPopup, markSetupSkipped, setShowSetupPopup } = useAppLockStore();
  const navigate = useNavigate();

  if (!supabaseUser || !showSetupPopup) return null;

  const handleEnableNow = () => {
    setShowSetupPopup(false);
    navigate('/settings'); // User configures App Lock in the Settings -> Security tab
  };

  const handleSkip = () => {
    markSetupSkipped(supabaseUser.id);
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-stone-950/80 p-5 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-8 text-center text-white relative">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur-md shadow-inner">
            <ShieldCheck size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-black">Protect Your Account</h2>
          <p className="mt-2 text-sm font-medium text-orange-100">
            Enable App Lock to secure your data with your device's biometric authentication or a custom PIN.
          </p>
        </div>
        
        <div className="p-6 space-y-3 bg-gray-50">
          <button
            onClick={handleEnableNow}
            className="w-full rounded-2xl bg-gray-900 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-black active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <ShieldCheck size={18} /> Enable Now (Recommended)
          </button>
          
          <button
            onClick={handleSkip}
            className="w-full rounded-2xl bg-white py-3.5 text-sm font-bold text-gray-600 shadow-sm border border-gray-200 transition-all hover:bg-gray-50 hover:text-gray-900 active:scale-[0.98]"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
