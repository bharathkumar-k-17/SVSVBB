import { useCallback, useEffect, useState } from 'react';
import { Lock, ShieldAlert } from 'lucide-react';
import {
  AppLockConfig,
  hasPlatformAuthenticator,
  hashSecret,
  loadAppLockConfig,
  verifyBiometric,
} from '../lib/app-lock';
import { useAuthStore } from '../store/authStore';

const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];

export function AppLock({ userId, config, onUnlock }: { userId: string, config: AppLockConfig, onUnlock: () => void }) {
  const { signOut } = useAuthStore();
  const [showPinPad, setShowPinPad] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutEndTime, setLockoutEndTime] = useState<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  
  const [fingerprintSupported, setFingerprintSupported] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    hasPlatformAuthenticator().then(setFingerprintSupported);
  }, []);

  // Lockout timer effect
  useEffect(() => {
    if (lockoutEndTime) {
      const interval = setInterval(() => {
        const remaining = Math.ceil((lockoutEndTime - Date.now()) / 1000);
        if (remaining <= 0) {
          setLockoutEndTime(null);
          setLockoutRemaining(0);
          setFailedAttempts(0); // reset attempts after lockout
          setError('');
        } else {
          setLockoutRemaining(remaining);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lockoutEndTime]);

  // Handle Keyboard Input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (lockoutEndTime || isVerifying || unlocking) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        setPin(pin.slice(0, -1));
        return;
      }

      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        if (!showPinPad) setShowPinPad(true);
        handlePinInput(e.key);
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      if (lockoutEndTime || isVerifying || unlocking) return;
      const text = e.clipboardData?.getData('text');
      if (text && /^\d{6}$/.test(text.trim())) {
        e.preventDefault();
        if (!showPinPad) setShowPinPad(true);
        const nextPin = text.trim();
        setPin(nextPin);
        setIsVerifying(true);
        verifyPin(nextPin);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePaste as any);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePaste as any);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, lockoutEndTime, isVerifying, unlocking, showPinPad]);

  const triggerVibrate = () => {
    if (config?.vibrate && navigator.vibrate) {
      navigator.vibrate(50);
    }
  };

  const unlockSuccess = useCallback(() => {
    triggerVibrate();
    setUnlocking(true);
    setTimeout(() => {
      onUnlock();
    }, 300);
  }, [config, onUnlock]);

  const handleFailedAttempt = () => {
    triggerVibrate();
    const attempts = failedAttempts + 1;
    setFailedAttempts(attempts);
    setPin('');
    setIsVerifying(false);
    
    if (attempts >= 5) {
      if (lockoutEndTime) {
        // Second time failing 5 times -> require password login (force logout)
        signOut();
      } else {
        // First time failing 5 times -> 30s lockout
        setLockoutEndTime(Date.now() + 30000);
        setError('Too many failed attempts. Try again in 30 seconds.');
      }
    } else {
      setError(`Incorrect PIN. ${5 - attempts} attempts remaining.`);
    }
  };

  const verifyPin = async (candidate: string) => {
    if (!config?.pinHash) {
      setError('App lock PIN is not configured.');
      setIsVerifying(false);
      return;
    }
    if ((await hashSecret(candidate)) === config.pinHash) {
      unlockSuccess();
    } else {
      handleFailedAttempt();
    }
  };

  const handlePinInput = (digit: string) => {
    if (lockoutEndTime || isVerifying || pin.length >= 6) return;
    const nextPin = `${pin}${digit}`.slice(0, 6);
    setPin(nextPin);
    
    // Auto-verify ONLY when exactly 6 digits are entered
    if (nextPin.length === 6) {
      setIsVerifying(true);
      verifyPin(nextPin);
    }
  };

  const handleUnlockClick = async () => {
    if (lockoutEndTime) return;
    
    // Prioritize Device Authentication
    if (fingerprintSupported && (config?.method === 'fingerprint' || config?.fingerprintEnabled)) {
      try {
        const success = await verifyBiometric();
        if (success) {
          unlockSuccess();
          return;
        }
      } catch (e) {
        console.error("Device auth error:", e);
      }
    }
    
    // Fallback to PIN
    setShowPinPad(true);
  };



  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-gradient-to-br from-gray-950 via-stone-900 to-black p-5 text-white">
      <div className={`flex flex-col items-center text-center transition-transform duration-300 ${unlocking ? 'scale-110 opacity-0' : 'scale-100 opacity-100'}`}>
        
        {/* Premium Branding */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-6 h-28 w-28 overflow-hidden rounded-full border-4 border-orange-500/30 bg-white p-1 shadow-[0_0_40px_rgba(249,115,22,0.2)]">
            <img src="/logo.jpg" alt="SVSVBB Logo" className="h-full w-full object-cover rounded-full" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
          <h1 className="bg-gradient-to-r from-orange-400 to-orange-200 bg-clip-text text-2xl font-black text-transparent md:text-3xl">
            శ్రీ వరసిద్ధి వినాయక భక్త బృందం
          </h1>
          <p className="mt-2 text-sm font-bold uppercase tracking-[0.3em] text-orange-500/70">
            Since 2008
          </p>
        </div>

        {/* Lockout Message */}
        {lockoutEndTime ? (
          <div className="mt-8 flex flex-col items-center animate-in fade-in zoom-in duration-300">
            <ShieldAlert size={48} className="mb-4 text-red-500" />
            <p className="text-lg font-bold text-red-400">App Locked for {lockoutRemaining}s</p>
            <p className="mt-2 text-sm text-gray-400">Too many failed attempts.</p>
          </div>
        ) : !showPinPad ? (
          /* Main Unlock Button */
          <button
            onClick={handleUnlockClick}
            className="group relative mt-12 flex h-16 items-center gap-3 overflow-hidden rounded-full bg-orange-600 pl-6 pr-8 font-bold text-white shadow-lg shadow-orange-900/50 transition-all hover:bg-orange-500 active:scale-95"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] transition-transform duration-1000 group-hover:translate-x-[100%]" />
            <Lock className="h-6 w-6" />
            <span className="text-lg tracking-wide">Unlock App</span>
          </button>
        ) : (
          /* PIN Pad Fallback */
          <div className="mt-8 w-full max-w-xs animate-in slide-in-from-bottom-8 fade-in duration-300">
            <div className="mb-6 flex justify-center gap-3">
              {Array.from({ length: 6 }, (_, index) => (
                <div
                  key={index}
                  className={`h-4 w-4 rounded-full border-2 transition-all duration-200 ${
                    index < pin.length
                      ? 'border-orange-500 bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]'
                      : 'border-gray-600 bg-transparent'
                  }`}
                />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-4">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handlePinInput(digit)}
                  className="flex h-16 items-center justify-center rounded-full bg-white/5 text-2xl font-light text-white backdrop-blur-sm transition-all hover:bg-white/10 active:scale-90"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPin(pin.slice(0, -1))}
                className="flex h-16 items-center justify-center rounded-full bg-white/5 text-sm font-bold uppercase tracking-wider text-gray-400 backdrop-blur-sm transition-all hover:bg-white/10 hover:text-white active:scale-90"
              >
                Del
              </button>
              <button
                type="button"
                onClick={() => handlePinInput('0')}
                className="flex h-16 items-center justify-center rounded-full bg-white/5 text-2xl font-light text-white backdrop-blur-sm transition-all hover:bg-white/10 active:scale-90"
              >
                0
              </button>
              <button
                type="button"
                onClick={() => setShowPinPad(false)}
                className="flex h-16 items-center justify-center rounded-full bg-white/5 text-sm font-bold uppercase tracking-wider text-gray-400 backdrop-blur-sm transition-all hover:bg-white/10 hover:text-white active:scale-90"
              >
                Back
              </button>
            </div>
            {error && (
              <p className="mt-6 text-center text-sm font-medium text-red-400 animate-in fade-in">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
