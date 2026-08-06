export type AppLockMethod = 'pin' | 'fingerprint' | 'pattern';

export interface AppLockConfig {
  enabled: boolean;
  method: AppLockMethod;
  pinHash?: string;
  patternHash?: string;
  inactivityMinutes: number;
  fingerprintEnabled?: boolean;
  webauthnCredentialId?: string;
  vibrate: boolean;
  sound: boolean;
  lockOnLogout: boolean;
  updatedAt: number;
}

export const getAppLockStorageKey = (userId: string) => `svsvbb_app_lock_config_${userId}`;

export const defaultAppLockConfig: AppLockConfig = {
  enabled: false,
  method: 'pin',
  inactivityMinutes: 2,
  vibrate: true,
  sound: false,
  lockOnLogout: true,
  updatedAt: Date.now(),
};

export const loadAppLockConfig = (userId?: string): AppLockConfig => {
  if (!userId) return defaultAppLockConfig;
  try {
    const raw = localStorage.getItem(getAppLockStorageKey(userId));
    return raw ? { ...defaultAppLockConfig, ...JSON.parse(raw) } : defaultAppLockConfig;
  } catch {
    return defaultAppLockConfig;
  }
};

export const saveAppLockConfig = (userId: string, config: AppLockConfig) => {
  if (!userId) return;
  const newConfig = { ...config, updatedAt: Date.now() };
  localStorage.setItem(getAppLockStorageKey(userId), JSON.stringify(newConfig));
  window.dispatchEvent(new CustomEvent('app-lock-config-change', { detail: { userId, config: newConfig } }));
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

export const registerBiometric = async (userId: string): Promise<string | null> => {
  try {
    const options: PublicKeyCredentialCreationOptions = {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "SVSVBB", id: window.location.hostname },
      user: {
        id: new TextEncoder().encode(userId.padEnd(16, '0').slice(0, 16)),
        name: "user@svsvbb.app",
        displayName: "SVSVBB User"
      },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
      timeout: 60000,
      attestation: "none"
    };
    const cred = await navigator.credentials.create({ publicKey: options }) as PublicKeyCredential;
    return cred ? cred.id : null;
  } catch (error) {
    console.error("Biometric registration failed", error);
    return null;
  }
};

export const verifyBiometric = async (): Promise<boolean> => {
  try {
    const options: PublicKeyCredentialRequestOptions = {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: window.location.hostname,
      userVerification: "required",
      timeout: 60000,
    };
    const assertion = await navigator.credentials.get({ publicKey: options });
    return !!assertion;
  } catch (error) {
    console.error("Biometric verification failed", error);
    return false;
  }
};
