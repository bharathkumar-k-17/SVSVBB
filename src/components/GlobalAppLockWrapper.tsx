import { useState, useEffect, ReactNode } from 'react';
import { loadAppLockConfig } from '../lib/app-lock';
import { AppLock } from './AppLock';

const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];

export function GlobalAppLockWrapper({ children }: { children: ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);
  const [initialized, setInitialized] = useState(false);
  
  // We read the last user ID synchronously so there's NO blank screen
  const lastUserId = typeof window !== 'undefined' ? localStorage.getItem('svsvbb_last_user_id') : null;
  const config = lastUserId ? loadAppLockConfig(lastUserId) : null;

  useEffect(() => {
    if (!lastUserId || !config?.enabled) {
      setInitialized(true);
      return;
    }

    // Determine initial lock state
    const lastActive = localStorage.getItem('app_last_active');
    if (lastActive && Date.now() - parseInt(lastActive, 10) < config.inactivityMinutes * 60 * 1000) {
      setIsLocked(false);
    } else {
      setIsLocked(true);
    }
    setInitialized(true);
  }, []); // Run once on mount

  // Background inactivity timer logic
  useEffect(() => {
    if (!lastUserId || !config?.enabled || isLocked || !initialized) return;

    let timeoutId = window.setTimeout(() => {
      localStorage.removeItem('app_last_active');
      setIsLocked(true);
    }, config.inactivityMinutes * 60 * 1000);

    const updateLastActive = () => {
      localStorage.setItem('app_last_active', Date.now().toString());
    };

    const resetTimer = () => {
      updateLastActive();
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        localStorage.removeItem('app_last_active');
        setIsLocked(true);
      }, config.inactivityMinutes * 60 * 1000);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
         updateLastActive();
         window.clearTimeout(timeoutId);
      } else {
         const lastActiveStr = localStorage.getItem('app_last_active');
         if (lastActiveStr) {
            const elapsed = Date.now() - parseInt(lastActiveStr, 10);
            if (elapsed >= config.inactivityMinutes * 60 * 1000) {
               setIsLocked(true);
               localStorage.removeItem('app_last_active');
            } else {
               resetTimer();
            }
         } else {
            setIsLocked(true);
         }
      }
    };

    activityEvents.forEach((eventName) => window.addEventListener(eventName, resetTimer, { passive: true }));
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    updateLastActive();

    return () => {
      window.clearTimeout(timeoutId);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [config?.enabled, config?.inactivityMinutes, isLocked, initialized, lastUserId]);

  if (!initialized) {
    return null; // Very brief, synchronous render
  }

  if (isLocked && lastUserId && config) {
    return <AppLock userId={lastUserId} config={config} onUnlock={() => setIsLocked(false)} />;
  }

  // Once unlocked (or if not enabled), render the full app (which then triggers data fetching)
  return <>{children}</>;
}
