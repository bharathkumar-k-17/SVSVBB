import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface AppLockState {
  showSetupPopup: boolean;
  checkSetupStatus: (userId: string | undefined) => void;
  setShowSetupPopup: (show: boolean) => void;
  markSetupSkipped: (userId: string) => void;
  syncLockStatus: (userId: string, enabled: boolean) => Promise<void>;
}

export const useAppLockStore = create<AppLockState>((set) => ({
  showSetupPopup: false,
  checkSetupStatus: (userId) => {
    if (!userId) {
      set({ showSetupPopup: false });
      return;
    }
    const skipped = localStorage.getItem(`svsvbb_app_lock_skipped_${userId}`);
    const configRaw = localStorage.getItem(`svsvbb_app_lock_config_${userId}`);
    
    // Only show if not skipped and no config exists
    if (!skipped && !configRaw) {
      set({ showSetupPopup: true });
    } else {
      set({ showSetupPopup: false });
    }
  },
  setShowSetupPopup: (show) => set({ showSetupPopup: show }),
  markSetupSkipped: (userId) => {
    localStorage.setItem(`svsvbb_app_lock_skipped_${userId}`, 'true');
    set({ showSetupPopup: false });
  },
  syncLockStatus: async (userId: string, enabled: boolean) => {
    try {
      const userAgent = navigator.userAgent;
      let deviceName = 'Web Browser';
      if (/windows/i.test(userAgent)) deviceName = 'Windows Device';
      else if (/macintosh|mac os x/i.test(userAgent)) deviceName = 'Mac';
      else if (/android/i.test(userAgent)) deviceName = 'Android Device';
      else if (/iphone|ipad|ipod/i.test(userAgent)) deviceName = 'iOS Device';

      await supabase.from('app_lock_status').upsert({
        user_id: userId,
        enabled,
        device_name: deviceName,
        last_updated: new Date().toISOString()
      }, { onConflict: 'user_id' });
    } catch (e) {
      console.error('Failed to sync app lock status:', e);
    }
  }
}));
