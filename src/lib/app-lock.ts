export type AppLockMethod = 'pin' | 'fingerprint' | 'pattern';

export interface AppLockConfig {
  enabled: boolean;
  method: AppLockMethod;
  pinHash?: string;
  patternHash?: string;
  inactivityMinutes: number;
  fingerprintEnabled?: boolean;
  updatedAt: number;
}

export const APP_LOCK_STORAGE_KEY = 'svsvbb_app_lock_config';

export const defaultAppLockConfig: AppLockConfig = {
  enabled: false,
  method: 'pin',
  inactivityMinutes: 5,
  updatedAt: Date.now(),
};

export const loadAppLockConfig = (): AppLockConfig => {
  try {
    const raw = localStorage.getItem(APP_LOCK_STORAGE_KEY);
    return raw ? { ...defaultAppLockConfig, ...JSON.parse(raw) } : defaultAppLockConfig;
  } catch {
    return defaultAppLockConfig;
  }
};

export const saveAppLockConfig = (config: AppLockConfig) => {
  localStorage.setItem(APP_LOCK_STORAGE_KEY, JSON.stringify({ ...config, updatedAt: Date.now() }));
  window.dispatchEvent(new Event('app-lock-config-change'));
};

export const hashSecret = async (secret: string) => {
  const bytes = new TextEncoder().encode(secret);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const hasPlatformAuthenticator = async () => {
  try {
    return Boolean(
      window.PublicKeyCredential &&
        (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()),
    );
  } catch {
    return false;
  }
};
