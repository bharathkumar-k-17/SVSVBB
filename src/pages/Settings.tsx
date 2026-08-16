import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../lib/supabase';
import { Settings as SettingsIcon, QrCode, User, Lock, CheckCircle2, ShieldCheck, Download, Upload, AlertTriangle, Fingerprint, Grid3X3, Eye, EyeOff, Image as ImageIcon, MessageSquare } from 'lucide-react';
import { AppLockMethod, hashSecret, hasPlatformAuthenticator, loadAppLockConfig, saveAppLockConfig, registerBiometric } from '../lib/app-lock';
import { MaskedPhoneInput } from '../components/MaskedPhoneInput';
import { normalizePhoneDigits } from '../lib/privacy';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAppSettings } from '../hooks/queries';
import { useAppLockStore } from '../store/appLockStore';

export function Settings() {
  const { appUser, supabaseUser } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: appSettings } = useAppSettings();

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  // Profile State
  const [name, setName] = useState(appUser?.name || '');
  const [phone, setPhone] = useState(appUser?.phone || '');

  // Password State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [showPins, setShowPins] = useState(false);

  // App Lock State
  const initialLockConfig = loadAppLockConfig(supabaseUser?.id);
  const [lockEnabled, setLockEnabled] = useState(initialLockConfig.enabled);
  const [lockMethod, setLockMethod] = useState<AppLockMethod>(initialLockConfig.method === 'pattern' ? 'pin' : initialLockConfig.method);
  const [lockPin, setLockPin] = useState('');
  const [lockConfirmPin, setLockConfirmPin] = useState('');
  const [inactivityMinutes, setInactivityMinutes] = useState(initialLockConfig.inactivityMinutes || 2);
  const [vibrate, setVibrate] = useState(initialLockConfig.vibrate ?? true);
  const [sound, setSound] = useState(initialLockConfig.sound ?? false);
  const [lockOnLogout, setLockOnLogout] = useState(initialLockConfig.lockOnLogout ?? true);
  const [fingerprintAvailable, setFingerprintAvailable] = useState(false);
  const { syncLockStatus } = useAppLockStore();

  // Asset State
  const [upiId, setUpiId] = useState('');
  const [upiMobile, setUpiMobile] = useState('');
  const [festivalStartDate, setFestivalStartDate] = useState('');

  // Branding State
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Message Templates State
  const [templates, setTemplates] = useState({
    chandaConfirmation: '',
    chandaPending: '',
    poojaConfirmation: '',
    poojaReminder: '',
    festivalGreeting: '',
  });

  // Reset State
  const [resetStep, setResetStep] = useState(0);
  const [resetPassword, setResetPassword] = useState('');
  const [resetText, setResetText] = useState('');
  const [resetOptions, setResetOptions] = useState({
    devotees: false,
    expenses: false,
    payment_histories: false,
    pooja_bookings: false,
    vip_gotrams: false,
    cultural_events: false,
    spl_records: false,
    feedback: false,
    qr_portal_settings: false,
    notifications: false,
  });

  const isSuperAdmin = appUser?.role === 'superadmin';

  useEffect(() => {
    hasPlatformAuthenticator().then(setFingerprintAvailable);
  }, []);

  useEffect(() => {
    if (isSuperAdmin && appSettings) {
      if (appSettings.upi_id) setUpiId(appSettings.upi_id);
      if (appSettings.upi_mobile) setUpiMobile(appSettings.upi_mobile);
      if (appSettings.festival_start_date) setFestivalStartDate(appSettings.festival_start_date);
      setTemplates({
        chandaConfirmation: appSettings.chanda_confirmation_template || '',
        chandaPending: appSettings.chanda_pending_template || '',
        poojaConfirmation: appSettings.pooja_confirmation_template || '',
        poojaReminder: appSettings.pooja_reminder_template || '',
        festivalGreeting: appSettings.festival_greeting_template || '',
      });
    }
  }, [isSuperAdmin, appSettings]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser) return;
    setLoading(true);
    try {
      await supabase.from('users').update({ name, phone: normalizePhoneDigits(phone) }).eq('id', appUser.id);
      toast.success('Profile updated successfully!');
    } catch (err) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabaseUser) return;
    if (newPassword !== confirmPassword) {
      toast.error('New password and confirm password do not match.');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAppLock = async (enabled: boolean) => {
    if (!supabaseUser?.id) return;
    setLockEnabled(enabled);

    const savedConfig = loadAppLockConfig(supabaseUser.id);

    if (!enabled) {
      saveAppLockConfig(supabaseUser.id, { ...savedConfig, enabled: false, updatedAt: Date.now() });
      await syncLockStatus(supabaseUser.id, false);
      toast.success('App lock disabled.');
    } else {
      if (savedConfig.pinHash || savedConfig.webauthnCredentialId) {
        saveAppLockConfig(supabaseUser.id, { ...savedConfig, enabled: true, updatedAt: Date.now() });
        await syncLockStatus(supabaseUser.id, true);
        toast.success('App lock enabled.');
      } else {
        toast.success('Please configure a PIN to enable App Lock.');
      }
    }
  };

  const handleSaveAppLock = async () => {
    if (!supabaseUser?.id) return;
    setLoading(true);
    try {
      if ((lockMethod === 'pin' || lockMethod === 'fingerprint') && lockPin && lockPin.length < 6) {
        toast.error('Set a 6-digit PIN.');
        return;
      }
      if ((lockMethod === 'pin' || lockMethod === 'fingerprint') && lockPin && lockPin !== lockConfirmPin) {
        toast.error('PIN and confirm PIN do not match.');
        return;
      }

      const savedConfig = loadAppLockConfig(supabaseUser.id);
      let pinHash = savedConfig.pinHash;
      if (lockPin) {
        pinHash = await hashSecret(lockPin);
      } else if (!pinHash) {
        toast.error('Please enter a 6-digit PIN.');
        return;
      }

      let webauthnCredentialId = savedConfig.webauthnCredentialId;
      if (lockMethod === 'fingerprint' && fingerprintAvailable) {
        const credId = await registerBiometric(supabaseUser.id);
        if (credId) {
          webauthnCredentialId = credId;
        } else {
          toast.error('Failed to register device auth. Falling back to PIN.');
          setLockMethod('pin');
        }
      }

      saveAppLockConfig(supabaseUser.id, {
        enabled: true, method: lockMethod, pinHash, inactivityMinutes, vibrate, sound, lockOnLogout,
        fingerprintEnabled: lockMethod === 'fingerprint' && fingerprintAvailable,
        webauthnCredentialId, updatedAt: Date.now(),
      });
      await syncLockStatus(supabaseUser.id, true);
      setLockPin(''); setLockConfirmPin('');
      toast.success('App lock settings saved securely.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUpiId = async () => {
    if (!upiId.trim()) return;
    setLoading(true);
    try {
      await supabase.from('app_settings').upsert({ id: 'app', upi_id: upiId.trim() });
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
      toast.success('UPI ID saved successfully!');
    } catch (err) {
      toast.error('Failed to save UPI ID');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUpiMobile = async () => {
    if (!upiMobile.trim()) return;
    if (upiMobile.trim().length !== 10) {
      toast.error('Mobile number must be exactly 10 digits.');
      return;
    }
    setLoading(true);
    try {
      await supabase.from('app_settings').upsert({ id: 'app', upi_mobile: upiMobile.trim() });
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
      toast.success('UPI Mobile Number saved successfully!');
    } catch (err) {
      toast.error('Failed to save UPI Mobile Number');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFestivalDate = async () => {
    if (!festivalStartDate) return;
    setLoading(true);
    try {
      await supabase.from('app_settings').upsert({ id: 'app', festival_start_date: festivalStartDate });
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
      toast.success('Festival Date saved successfully!');
    } catch (err) {
      toast.error('Failed to save Festival Date');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplates = async () => {
    setLoading(true);
    try {
      await supabase.from('app_settings').upsert({
        id: 'app',
        chanda_confirmation_template: templates.chandaConfirmation,
        chanda_pending_template: templates.chandaPending,
        pooja_confirmation_template: templates.poojaConfirmation,
        pooja_reminder_template: templates.poojaReminder,
        festival_greeting_template: templates.festivalGreeting,
      });
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
      toast.success('Message Templates saved successfully!');
    } catch (err) {
      toast.error('Failed to save Message Templates');
    } finally {
      setLoading(false);
    }
  };


  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (PNG, JPG, WEBP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB.');
      return;
    }

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logo_${Date.now()}.${fileExt}`;
      let finalLogoUrl = '';

      // Attempt to upload to 'logos' bucket
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.warn('Storage upload failed, falling back to Base64:', uploadError.message);
        // Fallback: Convert to Base64
        const toBase64 = (f: File) => new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(f);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
        });
        finalLogoUrl = await toBase64(file);
      } else {
        const { data: publicUrlData } = supabase.storage
          .from('logos')
          .getPublicUrl(uploadData.path);
        finalLogoUrl = publicUrlData.publicUrl;
      }

      await supabase.from('app_settings').upsert({ id: 'app', logo_url: finalLogoUrl });
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
      toast.success('Logo updated successfully! Changes will apply globally.');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to update logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleProfilePicChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !appUser) return;
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = document.createElement('img');
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          let width = img.width, height = img.height;
          const maxSize = 256;
          if (width > height) { if (width > maxSize) { height = Math.round((height * maxSize) / width); width = maxSize; } }
          else { if (height > maxSize) { width = Math.round((width * maxSize) / height); height = maxSize; } }
          canvas.width = width; canvas.height = height;
          canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
          const base64Url = canvas.toDataURL('image/jpeg', 0.8);
          await supabase.from('users').update({ photo_url: base64Url }).eq('id', appUser.id);
          toast.success('Profile picture updated successfully!');
          setLoading(false);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast.error('Failed to update profile picture');
      setLoading(false);
    }
  };

  const handleBackup = async () => {
    setLoading(true);
    const toastId = toast.loading('Generating backup snapshot...');
    try {
      const tables = [
        'devotees', 'expenses', 'payment_histories', 'pooja_bookings', 'pooja_slots',
        'vip_gotrams', 'cultural_events', 'spl_records', 'feedback',
        'feedback_questions', 'qr_portal_settings'
      ];
      const backupData: any = {};

      for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*');
        if (!error && data) {
          backupData[table] = data;
        }
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `svsvbb_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Backup exported successfully!', { id: toastId });
    } catch (e: any) {
      toast.error('Failed to export backup: ' + e.message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("⚠️ WARNING: Restoring will overwrite existing matching records. Are you sure?")) {
      e.target.value = '';
      return;
    }

    setLoading(true);
    const toastId = toast.loading('Restoring data from backup...');
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const backupData = JSON.parse(event.target?.result as string);
          let successCount = 0;

          for (const table of Object.keys(backupData)) {
            const records = backupData[table];
            if (Array.isArray(records) && records.length > 0) {
              const { error } = await supabase.from(table).upsert(records);
              if (!error) successCount++;
            }
          }

          toast.success(`Restore completed! Processed ${successCount} tables.`, { id: toastId });
        } catch (err: any) {
          toast.error('Failed to parse or restore backup data', { id: toastId });
        } finally {
          setLoading(false);
        }
      };
      reader.readAsText(file);
    } catch (err: any) {
      toast.error('Failed to read file', { id: toastId });
      setLoading(false);
    }
    e.target.value = '';
  };

  // ── RESET SYSTEM LOGIC ──
  const verifyResetPassword = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: appUser?.email || '',
        password: resetPassword
      });
      if (error) {
        toast.error('Incorrect Password');
        return;
      }
      setResetStep(2);
    } catch (e) {
      toast.error('Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const executeReset = async () => {
    setLoading(true);
    try {
      if (resetOptions.devotees) {
        await supabase.from('devotees').delete().not('id', 'is', null);
        await supabase.from('counters').delete().like('id', 'receipt_%');
      }
      if (resetOptions.expenses) await supabase.from('expenses').delete().not('id', 'is', null);
      if (resetOptions.payment_histories) await supabase.from('payment_histories').delete().not('id', 'is', null);
      if (resetOptions.vip_gotrams) await supabase.from('vip_gotrams').delete().not('id', 'is', null);
      if (resetOptions.cultural_events) await supabase.from('cultural_events').delete().not('id', 'is', null);
      if (resetOptions.spl_records) await supabase.from('spl_records').delete().not('id', 'is', null);
      if (resetOptions.feedback) {
        await supabase.from('feedback').delete().not('id', 'is', null);
        await supabase.from('feedback_questions').delete().not('id', 'is', null);
      }
      if (resetOptions.qr_portal_settings) {
        await supabase.from('qr_portal_settings').delete().not('id', 'is', null);
      }

      if (resetOptions.notifications) await supabase.from('notifications').delete().not('id', 'is', null);

      if (resetOptions.pooja_bookings) {
        await supabase.from('pooja_bookings').delete().not('id', 'is', null);
        await supabase.from('pooja_slots').update({ status: 'available' }).not('id', 'is', null);
      }

      toast.success('System successfully reset');
      setResetStep(0);
      setResetPassword('');
      setResetText('');
    } catch (e) {
      console.error(e);
      toast.error('Failed to reset system. Some tables may not exist.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAllReset = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setResetOptions({
      devotees: checked, expenses: checked, payment_histories: checked, pooja_bookings: checked,
      vip_gotrams: checked, cultural_events: checked, spl_records: checked, feedback: checked,
      qr_portal_settings: checked, notifications: checked,
    });
  };

  const isEverythingSelected = Object.values(resetOptions).every(v => v);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-gray-100 p-3 rounded-full border border-gray-200">
          <SettingsIcon className="text-gray-600 h-8 w-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">System Settings</h1>
          <p className="text-gray-500">Manage application preferences and security</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-64 space-y-2 flex-shrink-0">
          {[
            { id: 'general', label: 'General', icon: User, show: true },
            { id: 'festival', label: 'Festival Settings', icon: CheckCircle2, show: isSuperAdmin },
            { id: 'branding', label: 'Branding / Logo', icon: ImageIcon, show: isSuperAdmin },
            { id: 'templates', label: 'Message Templates', icon: MessageSquare, show: isSuperAdmin },
            { id: 'backup', label: 'Backup', icon: Download, show: isSuperAdmin },
            { id: 'restore', label: 'Restore', icon: Upload, show: isSuperAdmin },
            { id: 'reset', label: 'Reset System', icon: AlertTriangle, show: isSuperAdmin },
          ].filter(t => t.show).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === tab.id ? 'bg-orange-500 text-white shadow-md' : 'bg-white text-gray-600 hover:bg-orange-50'
                } ${tab.id === 'reset' ? 'hover:bg-red-50 hover:text-red-600' : ''}`}
            >
              <tab.icon size={18} /> {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px]">
          {activeTab === 'general' && (
            <div className="p-8 space-y-12">
              {/* Profile Details */}
              <section>
                <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-2 flex items-center gap-2"><User size={20} /> Profile Details</h2>
                <div className="flex items-center gap-6 mb-8 p-4 bg-orange-50/50 rounded-2xl border border-orange-100">
                  <div className="h-20 w-20 rounded-full bg-gradient-to-r from-orange-400 to-orange-600 flex items-center justify-center text-white font-black shadow-md overflow-hidden ring-4 ring-white">
                    {appUser?.photoURL ? (
                      <img src={appUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User size={32} />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-800 mb-2">Profile Picture</h3>
                    <input type="file" accept="image/*" onChange={handleProfilePicChange} className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:font-bold file:bg-white file:text-orange-600 file:shadow-sm hover:file:bg-orange-50 cursor-pointer" />
                  </div>
                </div>
                <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number</label>
                    <MaskedPhoneInput value={phone} onChange={setPhone} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none" />
                  </div>
                  <button type="submit" disabled={loading} className="px-6 py-2.5 bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-sm">Save Profile</button>
                </form>
              </section>

              {/* Password Change */}
              <section>
                <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-2 flex items-center gap-2"><Lock size={20} /> Security & Password</h2>
                <form onSubmit={handleUpdatePassword} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Old Password</label>
                    <div className="relative">
                      <input type={showPasswords ? "text" : "password"} required value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none pr-10" />
                      <button type="button" onClick={() => setShowPasswords(!showPasswords)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">New Password</label>
                    <div className="relative">
                      <input type={showPasswords ? "text" : "password"} required minLength={6} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none pr-10" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm Password</label>
                    <div className="relative">
                      <input type={showPasswords ? "text" : "password"} required minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none pr-10" />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="px-6 py-2.5 bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-sm">Change Password</button>
                </form>
              </section>

              {/* App Lock */}
              <section>
                <div className="flex items-center justify-between mb-4 border-b pb-2">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><ShieldCheck size={20} /> App Lock</h2>
                  <label className="inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={lockEnabled} onChange={(e) => handleToggleAppLock(e.target.checked)} className="sr-only peer" />
                    <span className="h-6 w-11 rounded-full bg-gray-200 peer-checked:bg-orange-500 after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full relative"></span>
                  </label>
                </div>
                {lockEnabled && (
                  <div className="space-y-6 max-w-xl">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { id: 'pin' as AppLockMethod, label: 'App PIN', icon: Lock },
                        { id: 'fingerprint' as AppLockMethod, label: 'Device Auth (Biometrics/PIN)', icon: Fingerprint, disabled: !fingerprintAvailable },
                      ].map((method) => (
                        <button key={method.id} type="button" disabled={method.disabled} onClick={() => setLockMethod(method.id)} className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-bold transition-all disabled:opacity-40 ${lockMethod === method.id ? 'border-orange-500 bg-orange-50 text-orange-600 shadow-[0_0_15px_rgba(249,115,22,0.15)]' : 'border-gray-200 bg-white text-gray-600 hover:bg-orange-50'}`}>
                          <method.icon size={22} /> {method.label}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-4 pt-4 border-t border-gray-100">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Set / Change 6-Digit PIN (Fallback)</label>
                        <div className="grid grid-cols-2 gap-4">
                          <input type="password" inputMode="numeric" placeholder="Enter PIN" maxLength={6} value={lockPin} onChange={(e) => setLockPin(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none font-black tracking-widest placeholder:font-normal placeholder:tracking-normal text-center" />
                          <input type="password" inputMode="numeric" placeholder="Confirm PIN" maxLength={6} value={lockConfirmPin} onChange={(e) => setLockConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))} className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none font-black tracking-widest placeholder:font-normal placeholder:tracking-normal text-center" />
                        </div>
                      </div>

                      <div className="pt-4 space-y-4 border-t border-gray-100">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-semibold text-gray-700">Auto Lock Timeout</label>
                          <select
                            value={inactivityMinutes}
                            onChange={(e) => setInactivityMinutes(parseFloat(e.target.value))}
                            className="px-3 py-1.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none bg-white text-sm"
                          >
                            <option value={0}>Immediately</option>
                            <option value={0.5}>30 seconds</option>
                            <option value={1}>1 minute</option>
                            <option value={2}>2 minutes</option>
                            <option value={5}>5 minutes</option>
                          </select>
                        </div>

                        <div className="flex items-center justify-between">
                          <label className="text-sm font-semibold text-gray-700">Unlock Vibration</label>
                          <label className="inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={vibrate} onChange={(e) => setVibrate(e.target.checked)} className="sr-only peer" />
                            <span className="h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-orange-500 after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full relative"></span>
                          </label>
                        </div>

                        <div className="flex items-center justify-between">
                          <label className="text-sm font-semibold text-gray-700">Lock Immediately After Logout</label>
                          <label className="inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={lockOnLogout} onChange={(e) => setLockOnLogout(e.target.checked)} className="sr-only peer" />
                            <span className="h-5 w-9 rounded-full bg-gray-200 peer-checked:bg-orange-500 after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full relative"></span>
                          </label>
                        </div>
                      </div>
                    </div>

                    <button type="button" onClick={handleSaveAppLock} disabled={loading} className="w-full mt-4 px-6 py-3.5 bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-wider text-sm rounded-xl shadow-lg shadow-orange-500/30 transition-all active:scale-[0.98]">Save Security Settings</button>
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === 'festival' && isSuperAdmin && (
            <div className="p-8 space-y-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-2">Festival Settings</h2>
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><QrCode size={18} /> Dynamic UPI Configuration</h3>
                <div className="flex items-center gap-4 max-w-md mb-4">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Committee UPI ID (QR Code)</label>
                    <input placeholder="UPI ID" value={upiId} onChange={(e) => setUpiId(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none" />
                  </div>
                  <button onClick={handleSaveUpiId} disabled={loading || !upiId.trim()} className="mt-5 px-6 py-2 bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-sm disabled:opacity-50">Save UPI</button>
                </div>

                <div className="flex items-center gap-4 max-w-md">
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Committee UPI-linked Mobile Number (Payment Apps)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="10-digit mobile number"
                      value={upiMobile}
                      onChange={(e) => setUpiMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                    />
                  </div>
                  <button onClick={handleSaveUpiMobile} disabled={loading || !upiMobile.trim() || upiMobile.trim().length !== 10} className="mt-5 px-6 py-2 bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-sm disabled:opacity-50">Save Mobile</button>
                </div>
              </div>
              <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><CheckCircle2 size={18} /> Festival Configuration</h3>
                <div className="flex items-center gap-4 max-w-md">
                  <input type="date" value={festivalStartDate} onChange={(e) => setFestivalStartDate(e.target.value)} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none" />
                  <button onClick={handleSaveFestivalDate} disabled={loading || !festivalStartDate} className="px-6 py-2 bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-sm disabled:opacity-50">Save Date</button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'branding' && isSuperAdmin && (
            <div className="p-8 space-y-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-2">Branding Settings</h2>
              <div className="bg-orange-50 p-6 rounded-xl border border-orange-200">
                <h3 className="font-bold text-orange-800 mb-2 flex items-center gap-2">
                  <ImageIcon size={18} /> Global Application Logo
                </h3>
                <p className="text-sm text-orange-700 mb-6">
                  Changing this logo will update it across the entire application instantly (Login, Dashboard, Portal, Receipts, etc). If no logo is uploaded, the default Ganesh logo is used.
                </p>
                <div className="flex flex-col md:flex-row items-center gap-8">
                  {/* Current Logo Preview */}
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Current Logo</span>
                    <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-white shadow-lg bg-white flex items-center justify-center">
                      <img
                        src={appSettings?.logo_url || '/logo.jpg'}
                        alt="Current Logo"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>

                  {/* Upload Controls */}
                  <div className="flex-1">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Upload New Logo (Max 2MB)</label>
                    <div className="flex items-center gap-4">
                      <label className="cursor-pointer px-6 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl shadow-sm transition-colors flex items-center gap-2">
                        {uploadingLogo ? 'Uploading...' : <><Upload size={18} /> Select Image</>}
                        <input
                          type="file"
                          accept="image/png, image/jpeg, image/webp"
                          className="hidden"
                          onChange={handleLogoUpload}
                          disabled={uploadingLogo}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'templates' && isSuperAdmin && (
            <div className="p-8 space-y-8">
              <div className="border-b pb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2"><MessageSquare size={20} className="text-orange-500" /> Message Templates</h2>
                <p className="text-gray-500 text-sm mt-1">Configure automated WhatsApp and SMS templates (Telugu UTF-8).</p>
              </div>

              <div className="space-y-8">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Chanda Confirmation Template</label>
                  <textarea
                    value={templates.chandaConfirmation}
                    onChange={(e) => setTemplates(p => ({ ...p, chandaConfirmation: e.target.value }))}
                    className="w-full h-40 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none resize-none font-mono text-sm"
                    placeholder="Enter Chanda Confirmation Template..."
                  />
                  <p className="text-xs text-gray-500 mt-1">Placeholders: {'{name}, {receiptNo}, {date}, {receiptLink}, {festivalYear}'}</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Chanda Pending Reminder Template</label>
                  <textarea
                    value={templates.chandaPending}
                    onChange={(e) => setTemplates(p => ({ ...p, chandaPending: e.target.value }))}
                    className="w-full h-32 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none resize-none font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Placeholders: {'{name}, {pendingAmount}, {festivalYear}'}</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Pooja Confirmation Template</label>
                  <textarea
                    value={templates.poojaConfirmation}
                    onChange={(e) => setTemplates(p => ({ ...p, poojaConfirmation: e.target.value }))}
                    className="w-full h-32 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none resize-none font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Placeholders: {'{name}, {poojaName}, {date}, {time}, {festivalYear}'}</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Pooja Reminder Template</label>
                  <textarea
                    value={templates.poojaReminder}
                    onChange={(e) => setTemplates(p => ({ ...p, poojaReminder: e.target.value }))}
                    className="w-full h-32 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none resize-none font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Placeholders: {'{name}, {poojaName}, {date}, {time}, {festivalYear}'}</p>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Festival Greeting Template</label>
                  <textarea
                    value={templates.festivalGreeting}
                    onChange={(e) => setTemplates(p => ({ ...p, festivalGreeting: e.target.value }))}
                    className="w-full h-32 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none resize-none font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">Placeholders: None</p>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    onClick={handleSaveTemplates}
                    disabled={loading}
                    className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2"
                  >
                    {loading ? <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <CheckCircle2 size={18} />}
                    Save Templates
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'backup' && isSuperAdmin && (
            <div className="p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-2">Backup System Data</h2>
              <p className="text-gray-500 mb-6">Export a full JSON snapshot of all system tables.</p>
              <button onClick={handleBackup} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md flex items-center gap-2">
                <Download size={20} /> Export Database to JSON
              </button>
            </div>
          )}

          {activeTab === 'restore' && isSuperAdmin && (
            <div className="p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-2">Restore System Data</h2>
              <p className="text-gray-500 mb-6">Import a previously exported JSON snapshot to restore data.</p>
              <div className="max-w-sm">
                <input type="file" accept=".json" onChange={handleRestore} disabled={loading} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50" />
              </div>
            </div>
          )}

          {activeTab === 'reset' && isSuperAdmin && (
            <div className="p-8">
              <h2 className="text-2xl font-black text-red-600 mb-2 flex items-center gap-2"><AlertTriangle size={24} /> Reset System</h2>
              <div className="bg-red-50 text-red-800 p-4 rounded-xl border border-red-200 font-medium mb-8">
                ⚠️ Warning: This action will permanently erase application data. This action cannot be undone.
              </div>

              {resetStep === 0 && (
                <button onClick={() => setResetStep(1)} className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl shadow-md">
                  Initiate System Reset
                </button>
              )}

              {resetStep === 1 && (
                <div className="space-y-4 max-w-sm animate-in fade-in slide-in-from-bottom-2">
                  <p className="font-bold text-gray-800">Step 1: Enter your Superadmin password to verify identity</p>
                  <input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="Current Password" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none" />
                  <div className="flex gap-3">
                    <button onClick={verifyResetPassword} disabled={loading || !resetPassword} className="px-6 py-2 bg-gray-900 text-white font-bold rounded-xl hover:bg-black flex-1">Verify</button>
                    <button onClick={() => { setResetStep(0); setResetPassword(''); }} className="px-6 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">Cancel</button>
                  </div>
                </div>
              )}

              {resetStep === 2 && (
                <div className="space-y-4 max-w-sm animate-in fade-in slide-in-from-bottom-2">
                  <p className="font-bold text-gray-800">Step 2: Type <span className="text-red-600 font-black">RESET</span> to confirm</p>
                  <input type="text" value={resetText} onChange={(e) => setResetText(e.target.value)} placeholder="Type RESET" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-bold" />
                  <div className="flex gap-3">
                    <button onClick={() => setResetStep(3)} disabled={resetText !== 'RESET'} className="px-6 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 flex-1 disabled:opacity-50 disabled:cursor-not-allowed">Continue</button>
                    <button onClick={() => { setResetStep(0); setResetText(''); setResetPassword(''); }} className="px-6 py-2 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">Cancel</button>
                  </div>
                </div>
              )}

              {resetStep === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                  <p className="font-bold text-gray-800">Step 3: Select data to erase permanently</p>

                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <label className="flex items-center gap-3 font-black text-gray-900 pb-3 border-b border-gray-200 mb-3 cursor-pointer">
                      <input type="checkbox" checked={isEverythingSelected} onChange={handleSelectAllReset} className="w-5 h-5 text-red-600 rounded" />
                      Everything
                    </label>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {Object.keys(resetOptions).map((key) => (
                        <label key={key} className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
                          <input type="checkbox" checked={(resetOptions as any)[key]} onChange={(e) => setResetOptions({ ...resetOptions, [key]: e.target.checked })} className="w-4 h-4 text-red-600 rounded" />
                          {key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={executeReset} disabled={loading || !Object.values(resetOptions).some(Boolean)} className="px-8 py-3 bg-red-600 text-white font-black rounded-xl hover:bg-red-700 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed">
                      {loading ? 'Erasing...' : 'Confirm Reset System'}
                    </button>
                    <button onClick={() => { setResetStep(0); setResetText(''); setResetPassword(''); }} className="px-6 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
