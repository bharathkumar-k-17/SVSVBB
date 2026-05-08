import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { doc, updateDoc, collection, query, getDocs, onSnapshot, deleteDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../lib/firebase';
import { Settings as SettingsIcon, QrCode, User, Lock, CheckCircle2, XCircle, Users, Trash2, Settings2, Fingerprint, Grid3X3, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { AppLockMethod, hashSecret, hasPlatformAuthenticator, loadAppLockConfig, saveAppLockConfig } from '../lib/app-lock';
import { MaskedPhoneInput } from '../components/MaskedPhoneInput';
import { maskPhoneNumber, normalizePhoneDigits } from '../lib/privacy';

export function Settings() {
  const { appUser, user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  
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
  const initialLockConfig = loadAppLockConfig();
  const [lockEnabled, setLockEnabled] = useState(initialLockConfig.enabled);
  const [lockMethod, setLockMethod] = useState<AppLockMethod>(initialLockConfig.method);
  const [lockPin, setLockPin] = useState('');
  const [lockConfirmPin, setLockConfirmPin] = useState('');
  const [lockPattern, setLockPattern] = useState<number[]>([]);
  const [inactivityMinutes, setInactivityMinutes] = useState(initialLockConfig.inactivityMinutes || 5);
  const [fingerprintAvailable, setFingerprintAvailable] = useState(false);
  
  // Asset State
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [upiId, setUpiId] = useState('');
  const [festivalStartDate, setFestivalStartDate] = useState('');

  // Users State
  const [allUsers, setAllUsers] = useState<any[]>([]);

  const isAdmin = appUser?.role === 'admin' || appUser?.role === 'super_admin';
  const isSuperAdmin = appUser?.role === 'super_admin';

  useEffect(() => {
    if (appUser?.role === 'admin' || appUser?.role === 'super_admin') {
      const q = query(collection(db, 'users'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAllUsers(users);
      });
      const fetchAppConfig = async () => {
        if (appUser.role !== 'super_admin') return;
        try {
          const snap = await getDoc(doc(db, 'settings', 'app'));
          if (snap.exists()) {
            if (snap.data().upiId) setUpiId(snap.data().upiId);
            if (snap.data().festivalStartDate) setFestivalStartDate(snap.data().festivalStartDate);
          }
        } catch (e) {}
      };
      fetchAppConfig();
      return () => unsubscribe();
    }
  }, [appUser]);

  useEffect(() => {
    hasPlatformAuthenticator().then(setFingerprintAvailable);
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appUser) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', appUser.uid), { name, phone: normalizePhoneDigits(phone) });
      alert('Profile updated successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.email) return;
    if (newPassword !== confirmPassword) {
      alert('New password and confirm password do not match.');
      return;
    }
    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, oldPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      alert('Password updated successfully!');
    } catch (err: any) {
      console.error(err);
      alert(err.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAppLock = async () => {
    setLoading(true);
    try {
      if (!lockEnabled) {
        saveAppLockConfig({
          enabled: false,
          method: lockMethod,
          inactivityMinutes,
          updatedAt: Date.now(),
        });
        alert('App lock disabled.');
        return;
      }

      if ((lockMethod === 'pin' || lockMethod === 'fingerprint') && lockPin.length < 4) {
        alert('Set a 4-6 digit PIN.');
        return;
      }

      if ((lockMethod === 'pin' || lockMethod === 'fingerprint') && lockPin !== lockConfirmPin) {
        alert('PIN and confirm PIN do not match.');
        return;
      }

      if (lockMethod === 'pattern' && lockPattern.length < 4) {
        alert('Select at least four pattern points.');
        return;
      }

      const savedConfig = loadAppLockConfig();
      const pinHash =
        lockMethod === 'pin' || lockMethod === 'fingerprint'
          ? await hashSecret(lockPin)
          : savedConfig.pinHash;
      const patternHash = lockMethod === 'pattern' ? await hashSecret(lockPattern.join('-')) : savedConfig.patternHash;

      saveAppLockConfig({
        enabled: true,
        method: lockMethod,
        pinHash,
        patternHash,
        inactivityMinutes,
        fingerprintEnabled: lockMethod === 'fingerprint' && fingerprintAvailable,
        updatedAt: Date.now(),
      });

      setLockPin('');
      setLockConfirmPin('');
      setLockPattern([]);
      alert('App lock saved successfully.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadAsset = async (file: File | null, type: 'qr') => {
    if (!file) return;
    setLoading(true);
    try {
      const storageRef = ref(storage, `settings/${type}_${Date.now()}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      // Store reference in settings collection
      await updateDoc(doc(db, 'settings', 'app'), { [`${type}Url`]: url }).catch(async () => {
         // Create if not exists
         const { setDoc } = await import('firebase/firestore');
         await setDoc(doc(db, 'settings', 'app'), { [`${type}Url`]: url }, { merge: true });
      });
      alert(`Asset uploaded successfully!`);
    } catch (err) {
      console.error(err);
      alert('Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUpiId = async () => {
    if (!upiId.trim()) return;
    setLoading(true);
    try {
      const { setDoc } = await import('firebase/firestore');
      await setDoc(doc(db, 'settings', 'app'), { upiId: upiId.trim() }, { merge: true });
      alert('UPI ID saved successfully! Dynamic QR codes will now be generated using this ID.');
    } catch (err) {
      console.error(err);
      alert('Failed to save UPI ID');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFestivalDate = async () => {
    if (!festivalStartDate) return;
    setLoading(true);
    try {
      const { setDoc } = await import('firebase/firestore');
      await setDoc(doc(db, 'settings', 'app'), { festivalStartDate }, { merge: true });
      alert('Festival Start Date saved successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to save Festival Date');
    } finally {
      setLoading(false);
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
          let width = img.width;
          let height = img.height;
          const maxSize = 256;
          
          if (width > height) {
            if (width > maxSize) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          const base64Url = canvas.toDataURL('image/jpeg', 0.8);
          await updateDoc(doc(db, 'users', appUser.uid), { photoURL: base64Url });
          alert('Profile picture updated successfully!');
          setLoading(false);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error(err);
      alert('Failed to update profile picture');
      setLoading(false);
    }
  };

  const handleUserApproval = async (uid: string, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'users', uid), { status });
    } catch (err) {
      console.error(err);
      alert('Failed to update user status');
    }
  };

  const handleUserDelete = async (uid: string) => {
    if (!window.confirm('Are you sure you want to delete this user? This cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'users', uid));
    } catch (err) {
      console.error(err);
      alert('Failed to delete user');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-gray-100 p-3 rounded-full border border-gray-200">
          <SettingsIcon className="text-gray-600 h-8 w-8" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">System Settings</h1>

        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-64 space-y-2">
          <button 
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'profile' ? 'bg-primary text-white shadow-md' : 'bg-white text-gray-600 hover:bg-orange-50'}`}
          >
            <User size={18} /> Profile Details
          </button>
          <button 
            onClick={() => setActiveTab('security')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'security' ? 'bg-primary text-white shadow-md' : 'bg-white text-gray-600 hover:bg-orange-50'}`}
          >
            <Lock size={18} /> Security
          </button>
          {(isAdmin || isSuperAdmin) && (
            <>
              {isSuperAdmin && (
                <button 
                  onClick={() => setActiveTab('assets')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'assets' ? 'bg-primary text-white shadow-md' : 'bg-white text-gray-600 hover:bg-orange-50'}`}
                >
                  <Settings2 size={18} /> App Core Config
                </button>
              )}
              <button 
                onClick={() => setActiveTab('users')}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold transition-colors ${activeTab === 'users' ? 'bg-primary text-white shadow-md' : 'bg-white text-gray-600 hover:bg-orange-50'}`}
              >
                <div className="flex items-center gap-3"><Users size={18} /> User Management</div>
                {allUsers.filter(u => u.status === 'pending').length > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{allUsers.filter(u => u.status === 'pending').length}</span>}
              </button>
            </>
          )}
        </div>

        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden min-h-[400px]">
          {activeTab === 'profile' && (
            <div className="p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-4">Profile Information</h2>
              
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
                  <div className="flex items-center gap-3">
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={handleProfilePicChange}
                      className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:font-bold file:bg-white file:text-primary file:shadow-sm hover:file:bg-orange-50 cursor-pointer"
                    />
                    {loading && <span className="text-xs font-semibold text-gray-500">Processing...</span>}
                  </div>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-5 max-w-md">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary shadow-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number</label>
                  <MaskedPhoneInput
                    value={phone}
                    onChange={setPhone}
                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary shadow-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Email <span className="text-xs font-normal text-gray-400">(readonly)</span></label>
                  <input
                    type="email"
                    value={appUser?.email}
                    disabled
                    className="w-full px-4 py-2 border border-gray-200 bg-gray-50 rounded-xl text-gray-500 cursor-not-allowed"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2.5 bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-sm transition-colors mt-4 disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Save Profile'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-4">Security</h2>

              <form onSubmit={handleUpdatePassword} className="space-y-5 max-w-md">
                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Lock size={18} /> Change Password</h3>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Old Password</label>
                  <div className="relative">
                    <input
                      type={showPasswords ? "text" : "password"}
                      required
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary shadow-sm outline-none pr-10"
                      placeholder=""
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(!showPasswords)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showPasswords ? "text" : "password"}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary shadow-sm outline-none pr-10"
                      placeholder=""
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(!showPasswords)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showPasswords ? "text" : "password"}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary shadow-sm outline-none pr-10"
                      placeholder=""
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords(!showPasswords)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading || !oldPassword || !newPassword || !confirmPassword}
                  className="px-6 py-2.5 bg-gray-900 hover:bg-black text-white font-bold rounded-xl shadow-sm transition-colors mt-4 disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Change Password'}
                </button>
              </form>

              <div className="mt-10 border-t pt-8">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><ShieldCheck size={18} /> App Lock</h3>
                    <p className="text-xs font-semibold text-gray-500 mt-1">Locks on app open and after inactivity.</p>
                  </div>
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lockEnabled}
                      onChange={(e) => setLockEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <span className="h-7 w-12 rounded-full bg-gray-200 after:ml-1 after:mt-1 after:block after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all peer-checked:bg-primary peer-checked:after:translate-x-5" />
                  </label>
                </div>

                {lockEnabled && (
                  <div className="space-y-6 max-w-xl">
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { id: 'pin' as AppLockMethod, label: 'PIN', icon: Lock },
                        { id: 'fingerprint' as AppLockMethod, label: 'Fingerprint', icon: Fingerprint, disabled: !fingerprintAvailable },
                        { id: 'pattern' as AppLockMethod, label: 'Pattern', icon: Grid3X3 },
                      ].map((method) => (
                        <button
                          key={method.id}
                          type="button"
                          disabled={method.disabled}
                          onClick={() => setLockMethod(method.id)}
                          className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-bold transition-all disabled:opacity-40 ${
                            lockMethod === method.id
                              ? 'border-primary bg-orange-50 text-primary'
                              : 'border-gray-200 bg-white text-gray-600 hover:bg-orange-50'
                          }`}
                        >
                          <method.icon size={22} />
                          {method.label}
                        </button>
                      ))}
                    </div>

                    {(lockMethod === 'pin' || lockMethod === 'fingerprint') && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">PIN</label>
                          <div className="relative">
                            <input
                              type={showPins ? "text" : "password"}
                              inputMode="numeric"
                              maxLength={6}
                              value={lockPin}
                              onChange={(e) => setLockPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary shadow-sm outline-none pr-10"
                              placeholder=""
                            />
                            <button
                              type="button"
                              onClick={() => setShowPins(!showPins)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                            >
                              {showPins ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm PIN</label>
                          <div className="relative">
                            <input
                              type={showPins ? "text" : "password"}
                              inputMode="numeric"
                              maxLength={6}
                              value={lockConfirmPin}
                              onChange={(e) => setLockConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary shadow-sm outline-none pr-10"
                              placeholder=""
                            />
                            <button
                              type="button"
                              onClick={() => setShowPins(!showPins)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                            >
                              {showPins ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {lockMethod === 'pattern' && (
                      <div className="grid w-48 grid-cols-3 gap-3">
                        {Array.from({ length: 9 }, (_, index) => {
                          const point = index + 1;
                          const active = lockPattern.includes(point);
                          return (
                            <button
                              key={point}
                              type="button"
                              onClick={() => {
                                if (!active) setLockPattern([...lockPattern, point]);
                              }}
                              className={`h-12 w-12 rounded-full border-2 transition-all ${
                                active ? 'border-primary bg-primary text-white' : 'border-gray-200 bg-gray-50 text-gray-400'
                              }`}
                            >
                              {point}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setLockPattern([])}
                          className="col-span-3 rounded-xl bg-gray-100 py-2 text-sm font-bold text-gray-700"
                        >
                          Reset Pattern
                        </button>
                      </div>
                    )}

                    <div className="max-w-xs">
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Inactivity Minutes</label>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={inactivityMinutes}
                        onChange={(e) => setInactivityMinutes(Math.max(1, Math.min(60, Number(e.target.value) || 5)))}
                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary shadow-sm outline-none"
                        placeholder=""
                      />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSaveAppLock}
                  disabled={loading}
                  className="mt-6 px-6 py-2.5 bg-primary hover:bg-orange-600 text-white font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50"
                >
                  {loading ? 'Saving...' : 'Save App Lock'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'assets' && isSuperAdmin && (
            <div className="p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 border-b pb-4">Core Application Config</h2>
              
              <div className="space-y-8">
                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                  <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><QrCode size={18} /> Dynamic UPI Configuration</h3>

                  
                  <div className="flex items-center gap-4">
                    <input 
                      placeholder="UPI ID"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary shadow-sm outline-none"
                    />
                    <button 
                      onClick={handleSaveUpiId}
                      disabled={loading || !upiId.trim()}
                      className="px-6 py-2 bg-primary hover:bg-orange-600 text-white font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : 'Save UPI ID'}
                    </button>
                  </div>
                </div>

                <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                  <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2"><CheckCircle2 size={18} /> Festival Configuration</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Festival Start Date</label>
                      <input 
                        type="date"
                        value={festivalStartDate}
                        onChange={(e) => setFestivalStartDate(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary shadow-sm outline-none"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={handleSaveFestivalDate}
                    disabled={loading || !festivalStartDate}
                    className="mt-4 px-6 py-2 bg-primary hover:bg-orange-600 text-white font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save Festival Config'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && isAdmin && (
            <div className="p-8">
              <div className="flex justify-between items-end mb-6 border-b pb-4">
                <h2 className="text-xl font-bold text-gray-900">User Management</h2>
                <div className="text-sm font-bold text-gray-500">Total: {allUsers.length}</div>
              </div>

              {allUsers.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No users found.</div>
              ) : (
                <div className="space-y-4">
                  {allUsers.map(u => (
                    <div key={u.id} className="border border-orange-100 bg-orange-50/30 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full overflow-hidden bg-white shadow-sm ring-2 ring-orange-200">
                           {u.photoURL ? (
                             <img src={u.photoURL} alt="Profile" className="w-full h-full object-cover" />
                           ) : (
                             <div className="w-full h-full flex items-center justify-center bg-gray-100 font-bold text-gray-400">
                               {u.name?.charAt(0)?.toUpperCase()}
                             </div>
                           )}
                        </div>
                        <div>
                          <div className="font-bold text-gray-900 text-lg flex items-center gap-2">
                            {u.name}
                            <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${u.status === 'approved' ? 'bg-green-100 text-green-700' : u.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{u.status}</span>
                          </div>
                          <div className="text-sm text-gray-600"><span className="font-semibold">{u.email}</span> • {u.phone}</div>
                          <div className="text-xs uppercase tracking-wide text-primary font-bold mt-1 bg-white inline-block px-2 py-0.5 rounded shadow-sm border border-orange-100">{u.role}</div>
                          {u.username && <span className="ml-2 text-xs font-mono text-gray-400">@{u.username}</span>}
                        </div>
                      </div>
                      
                      <div className="flex gap-2 w-full sm:w-auto mt-3 sm:mt-0 flex-wrap sm:flex-nowrap">
                        {u.status !== 'approved' && (
                          <button 
                            onClick={() => handleUserApproval(u.id, 'approved')}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 hover:bg-green-500 hover:text-white transition-colors font-bold rounded-lg shadow-sm text-sm"
                          >
                            <CheckCircle2 size={14} /> Approve
                          </button>
                        )}
                        {u.status !== 'rejected' && (
                          <button 
                            onClick={() => handleUserApproval(u.id, 'rejected')}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-yellow-50 text-yellow-600 hover:bg-yellow-500 hover:text-white transition-colors font-bold rounded-lg shadow-sm text-sm"
                          >
                            <XCircle size={14} /> Reject
                          </button>
                        )}
                        <button 
                          onClick={() => handleUserDelete(u.id)}
                          className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white transition-colors font-bold rounded-lg shadow-sm text-sm"
                        >
                           <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
