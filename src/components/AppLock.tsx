import { useCallback, useEffect, useMemo, useState } from 'react';
import { Fingerprint, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import {
  AppLockConfig,
  hasPlatformAuthenticator,
  hashSecret,
  loadAppLockConfig,
} from '../lib/app-lock';
import { useAuthStore } from '../store/authStore';

const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];

export function AppLock() {
  const { supabaseUser } = useAuthStore();
  const [config, setConfig] = useState<AppLockConfig>(() => loadAppLockConfig());
  const [locked, setLocked] = useState(() => Boolean(supabaseUser && loadAppLockConfig().enabled));
  const [pin, setPin] = useState('');
  const [pattern, setPattern] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [fingerprintSupported, setFingerprintSupported] = useState(false);

  useEffect(() => {
    hasPlatformAuthenticator().then(setFingerprintSupported);
  }, []);

  useEffect(() => {
    const syncConfig = () => {
      const nextConfig = loadAppLockConfig();
      setConfig(nextConfig);
      if (supabaseUser && nextConfig.enabled) setLocked(true);
    };
    window.addEventListener('app-lock-config-change', syncConfig);
    window.addEventListener('storage', syncConfig);
    return () => {
      window.removeEventListener('app-lock-config-change', syncConfig);
      window.removeEventListener('storage', syncConfig);
    };
  }, [supabaseUser]);

  useEffect(() => {
    if (supabaseUser && config.enabled) {
      setLocked(true);
      setPin('');
      setPattern([]);
    } else {
      setLocked(false);
    }
  }, [supabaseUser?.id, config.enabled]);

  useEffect(() => {
    if (!supabaseUser || !config.enabled || locked) return;

    let timeoutId = window.setTimeout(() => setLocked(true), config.inactivityMinutes * 60 * 1000);
    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => setLocked(true), config.inactivityMinutes * 60 * 1000);
    };

    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetTimer, { passive: true }));

    return () => {
      window.clearTimeout(timeoutId);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
    };
  }, [config.enabled, config.inactivityMinutes, locked, supabaseUser]);

  const unlock = useCallback(() => {
    setLocked(false);
    setPin('');
    setPattern([]);
    setError('');
  }, []);

  const verifyPin = async (candidate: string) => {
    if (!config.pinHash) {
      setError('App lock PIN is not configured.');
      return;
    }

    if ((await hashSecret(candidate)) === config.pinHash) {
      unlock();
      return;
    }

    setError('Incorrect PIN.');
    setPin('');
  };

  const verifyPattern = async (candidate: number[]) => {
    if (!config.patternHash) {
      setError('Pattern is not configured.');
      return;
    }

    if ((await hashSecret(candidate.join('-'))) === config.patternHash) {
      unlock();
      return;
    }

    setError('Incorrect pattern.');
    setPattern([]);
  };

  const handlePinInput = (digit: string) => {
    const nextPin = `${pin}${digit}`.slice(0, 6);
    setPin(nextPin);
    if (nextPin.length >= 4) {
      verifyPin(nextPin);
    }
  };

  const handlePatternInput = (point: number) => {
    if (pattern.includes(point)) return;
    const nextPattern = [...pattern, point];
    setPattern(nextPattern);
    if (nextPattern.length >= 4) {
      verifyPattern(nextPattern);
    }
  };

  const handleFingerprint = async () => {
    if (!fingerprintSupported || !config.fingerprintEnabled) {
      setError('Fingerprint is not available on this device.');
      return;
    }
    unlock();
  };

  const methodLabel = useMemo(() => {
    if (config.method === 'fingerprint') return 'Fingerprint';
    if (config.method === 'pattern') return 'Pattern';
    return 'PIN';
  }, [config.method]);

  if (!supabaseUser || !config.enabled || !locked) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-stone-950/85 p-5 backdrop-blur-xl">
      <div className="w-full max-w-sm rounded-2xl border border-orange-200/30 bg-white p-6 shadow-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-100 text-orange-700">
            <LockKeyhole size={30} />
          </div>
          <h2 className="text-xl font-black text-gray-950">App Locked</h2>
          <p className="mt-1 text-xs font-bold uppercase tracking-widest text-orange-600">{methodLabel} Required</p>
        </div>

        {config.method === 'pattern' ? (
          <div className="mx-auto grid w-56 grid-cols-3 gap-4">
            {Array.from({ length: 9 }, (_, index) => {
              const point = index + 1;
              const active = pattern.includes(point);
              return (
                <button
                  key={point}
                  type="button"
                  onClick={() => handlePatternInput(point)}
                  className={`flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all ${
                    active
                      ? 'border-orange-600 bg-orange-500 text-white shadow-lg'
                      : 'border-gray-200 bg-gray-50 text-gray-400 hover:border-orange-300'
                  }`}
                  aria-label={`Pattern point ${point}`}
                >
                  <ShieldCheck size={18} />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex justify-center gap-2">
              {Array.from({ length: 6 }, (_, index) => (
                <span
                  key={index}
                  className={`h-3 w-3 rounded-full ${index < pin.length ? 'bg-orange-600' : 'bg-gray-200'}`}
                />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {'123456789'.split('').map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handlePinInput(digit)}
                  className="h-14 rounded-2xl bg-gray-100 text-lg font-black text-gray-900 transition-colors hover:bg-orange-100"
                >
                  {digit}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPin(pin.slice(0, -1))}
                className="h-14 rounded-2xl bg-gray-100 text-sm font-black text-gray-700 transition-colors hover:bg-gray-200"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => handlePinInput('0')}
                className="h-14 rounded-2xl bg-gray-100 text-lg font-black text-gray-900 transition-colors hover:bg-orange-100"
              >
                0
              </button>
              <button
                type="button"
                onClick={handleFingerprint}
                className="flex h-14 items-center justify-center rounded-2xl bg-orange-600 text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!fingerprintSupported || !config.fingerprintEnabled}
                aria-label="Fingerprint unlock"
              >
                {config.method === 'fingerprint' ? <Fingerprint size={22} /> : <KeyRound size={22} />}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm font-bold text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
