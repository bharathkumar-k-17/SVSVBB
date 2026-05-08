import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  EmailAuthProvider,
  linkWithCredential,
  updateProfile,
  type ConfirmationResult,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { Mail, Lock, Eye, EyeOff, Loader2, User, Phone, Shield } from 'lucide-react';
import { toIndianE164 } from '../lib/privacy';

type TabMode = 'login' | 'signup';

const ROLE_LIMITS: Record<string, number> = {
  super_admin: 1,
  admin: 5,
};

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();

  const [tab, setTab] = useState<TabMode>(location.pathname === '/signup' ? 'signup' : 'login');

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [resetMode, setResetMode] = useState(false);

  // Signup state
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'volunteer' | 'admin' | 'super_admin'>('volunteer');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [roleLimits, setRoleLimits] = useState<Record<string, number>>({
    super_admin: 0,
    admin: 0,
  });
  const [limitsLoaded, setLimitsLoaded] = useState(false);
  const [otpStage, setOtpStage] = useState(false);
  const [otp, setOtp] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);
  const [showSignInAfterOtp, setShowSignInAfterOtp] = useState(false);

  // Google Modal State
  const [pendingGoogleUser, setPendingGoogleUser] = useState<any>(null);
  const [gUsername, setGUsername] = useState('');
  const [gPhone, setGPhone] = useState('');
  const [gRole, setGRole] = useState<'volunteer' | 'admin' | 'super_admin'>('volunteer');

  // Info message from redirect
  const [infoMsg, setInfoMsg] = useState(location.state?.message || '');

  useEffect(() => {
    if (location.state?.message) {
      setTab('login');
      setInfoMsg(location.state.message);
      window.history.replaceState({}, document.title);
    }
  }, []);

  // Fetch existing role counts on mount
  useEffect(() => {
    const fetchRoleCounts = async () => {
      try {
        const counts: Record<string, number> = { super_admin: 0, admin: 0 };
        for (const r of ['super_admin', 'admin']) {
          const q = query(collection(db, 'users'), where('role', '==', r));
          const snap = await getDocs(q);
          counts[r] = snap.size;
        }
        setRoleLimits(counts);
      } catch {
        // ignore
      } finally {
        setLimitsLoaded(true);
      }
    };
    fetchRoleCounts();
  }, []);

  const isRoleFull = (r: string) => {
    if (!ROLE_LIMITS[r]) return false;
    return roleLimits[r] >= ROLE_LIMITS[r];
  };

  // ── LOGIN ──────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setInfoMsg('');
    
    // If in reset mode
    if (resetMode) {
      if (!loginEmail) {
        setLoginError('Please enter your email to reset password.');
        return;
      }
      setLoginLoading(true);
      try {
        await sendPasswordResetEmail(auth, loginEmail.trim());
        setInfoMsg('Password reset link sent! Check your inbox.');
        setResetMode(false);
      } catch (err: any) {
        setLoginError('Failed to send reset email. ' + err.message);
      } finally {
        setLoginLoading(false);
      }
      return;
    }

    if (!loginEmail || !loginPassword) {
      setLoginError('Please provide email and password.');
      return;
    }
    setLoginLoading(true);
    try {
      let finalEmail = loginEmail.trim();

      // IF IT DOESN'T LOOK LIKE AN EMAIL, resolve username or phone
      if (!finalEmail.includes('@')) {
        const usersRef = collection(db, 'users');
        const usernameQ = query(usersRef, where('username', '==', finalEmail.toLowerCase().trim()));
        let snap = await getDocs(usernameQ);
        
        if (snap.empty) {
          const phoneQ = query(usersRef, where('phone', '==', finalEmail.trim()));
          snap = await getDocs(phoneQ);
        }

        if (!snap.empty) {
          finalEmail = snap.docs[0].data().email;
        } else {
          setLoginError('No account found with this username or phone number.');
          setLoginLoading(false);
          return;
        }
      }

      const cred = await signInWithEmailAndPassword(auth, finalEmail, loginPassword);
      await checkAndNavigate(cred.user.uid);
    } catch (err: any) {
      await firebaseSignOut(auth).catch(() => {});
      if (err.code === 'auth/invalid-credential') {
        setLoginError('Invalid email or password.');
      } else {
        setLoginError(err.message || 'Authentication failed.');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // ── GOOGLE LOGIN ───────────────────────────────────────
  const handleGoogle = async () => {
    setLoginError('');
    setLoginLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const cred = await signInWithPopup(auth, provider);
      const uid = cred.user.uid;
      const docRef = doc(db, 'users', uid);
      const snap = await getDoc(docRef);

      if (!snap.exists()) {
        const usersSnap = await getDocs(query(collection(db, 'users'), limit(1)));
        const isFirstUser = usersSnap.empty;
        const defaultRole = isFirstUser ? 'super_admin' : 'volunteer';
        const status = isFirstUser ? 'approved' : 'pending';

        await setDoc(docRef, {
          uid,
          name: cred.user.displayName || cred.user.email?.split('@')[0] || 'Google User',
          username: cred.user.email ? cred.user.email.split('@')[0].toLowerCase() : `user-${uid.slice(0, 6)}`,
          email: cred.user.email || '',
          phone: '',
          photoURL: cred.user.photoURL || '',
          role: defaultRole,
          status,
          createdAt: Date.now(),
        });

        if (status !== 'approved') {
          await firebaseSignOut(auth);
          setInfoMsg('Google account created. Waiting for admin approval.');
          setTab('login');
          setLoginLoading(false);
          return;
        }
      }

      await checkAndNavigate(uid);
    } catch (err: any) {
      await firebaseSignOut(auth).catch(() => {});
      setLoginError(err.message || 'Google sign-in failed.');
    } finally {
      setLoginLoading(false);
    }
  };

  const submitGoogleProfile = async () => {
    if (!pendingGoogleUser) return;
    setLoginError('');
    if (!gUsername.trim()) { setLoginError('Username required'); return; }
    
    // Check limits
    if (ROLE_LIMITS[gRole] !== undefined && roleLimits[gRole] >= ROLE_LIMITS[gRole]) {
      setLoginError(`${gRole} role is full.`);
      return;
    }

    setLoginLoading(true);
    try {
      // Check username
      const q = query(collection(db, 'users'), where('username', '==', gUsername.toLowerCase().trim()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setLoginError('Username is already taken');
        setLoginLoading(false);
        return;
      }

      await setDoc(doc(db, 'users', pendingGoogleUser.uid), {
        name: pendingGoogleUser.displayName || '',
        username: gUsername.toLowerCase().trim(),
        email: pendingGoogleUser.email || '',
        phone: gPhone.trim(),
        photoURL: pendingGoogleUser.photoURL || '',
        role: gRole,
        status: 'pending',
        createdAt: Date.now(),
      });
      await firebaseSignOut(auth);
      setPendingGoogleUser(null);
      setInfoMsg('Google account registered! Waiting for admin approval.');
      setTab('login');
    } catch (err: any) {
      setLoginError(err.message || 'Profile setup failed.');
    } finally {
      setLoginLoading(false);
    }
  };

  const checkAndNavigate = async (uid: string) => {
    const snap = await getDoc(doc(db, 'users', uid));
    if (!snap.exists()) {
      await firebaseSignOut(auth);
      setLoginError('User profile not found in system.');
      return;
    }
    const data = snap.data();
    if (data.status !== 'approved') {
      await firebaseSignOut(auth);
      setLoginError('Your account is pending approval. Please wait for admin to approve.');
      return;
    }
    navigate('/dashboard');
  };

  // ── SIGNUP ─────────────────────────────────────────────
  const validateSignup = () => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Full name is required';
    if (!username.trim()) errors.username = 'Username is required';
    else if (/\s/.test(username)) errors.username = 'Username cannot contain spaces';
    
    const phoneRegex = /^\d{10}$/;
    if (!phoneRegex.test(phone)) errors.phone = 'Phone must be exactly 10 digits';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) errors.email = 'Enter a valid email address';
    if (password.length < 6) errors.password = 'Password must be at least 6 characters';
    if (password !== confirmPassword) errors.confirmPassword = 'Passwords do not match';
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getSignupVerifier = () => {
    if (recaptchaVerifier) return recaptchaVerifier;
    const verifier = new RecaptchaVerifier(auth, 'signup-recaptcha', { size: 'invisible' });
    setRecaptchaVerifier(verifier);
    return verifier;
  };

  const assertSignupAvailable = async () => {
    if (ROLE_LIMITS[role] !== undefined && roleLimits[role] >= ROLE_LIMITS[role]) {
      throw new Error(
        `${role.charAt(0).toUpperCase() + role.slice(1)} slots are full (max ${ROLE_LIMITS[role]}).`,
      );
    }

    const uQ = query(collection(db, 'users'), where('username', '==', username.toLowerCase().trim()));
    const uSnap = await getDocs(uQ);
    if (!uSnap.empty) throw new Error('Username is already taken');

    const pQ = query(collection(db, 'users'), where('phone', '==', phone.trim()));
    const pSnap = await getDocs(pQ);
    if (!pSnap.empty) throw new Error('Phone number is already associated with another account');
  };

  const createSignupProfile = async (phoneUser: FirebaseUser) => {
    await assertSignupAvailable();

    const emailCredential = EmailAuthProvider.credential(email.trim(), password);
    const linkedCredential = await linkWithCredential(phoneUser, emailCredential);
    await updateProfile(linkedCredential.user, { displayName: name.trim() });

    await setDoc(doc(db, 'users', linkedCredential.user.uid), {
      uid: linkedCredential.user.uid,
      name: name.trim(),
      username: username.toLowerCase().trim(),
      email: email.trim(),
      phone: phone.trim(),
      role,
      photoURL: '',
      status: 'pending',
      createdAt: Date.now(),
    });

    await firebaseSignOut(auth);
  };

  const handleSignup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSignupError('');
    setSignupSuccess('');
    if (!validateSignup()) return;

    if (!otpStage) {
      setSignupLoading(true);
      try {
        await assertSignupAvailable();
        const verifier = getSignupVerifier();
        const result = await signInWithPhoneNumber(auth, toIndianE164(phone), verifier);
        setConfirmationResult(result);
        setOtpStage(true);
        setSignupSuccess('OTP sent successfully.');
      } catch (err: any) {
        setSignupError(err.message || 'Failed to send OTP.');
        recaptchaVerifier?.clear();
        setRecaptchaVerifier(null);
      } finally {
        setSignupLoading(false);
      }
      return;
    }

    if (!confirmationResult) {
      setSignupError('OTP session expired. Send OTP again.');
      setOtpStage(false);
      return;
    }

    if (otp.length !== 6) {
      setSignupError('Enter the 6-digit OTP.');
      return;
    }

    setSignupLoading(true);
    try {
      const phoneCredential = await confirmationResult.confirm(otp);
      await createSignupProfile(phoneCredential.user);
      setShowSignInAfterOtp(true);
      setSignupSuccess('Phone verified. Registration submitted for admin approval.');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setSignupError('Email address is already in use.');
      } else {
        setSignupError(err.message || 'OTP verification failed.');
      }
    } finally {
      setSignupLoading(false);
    }
  };

  const resetSignup = () => {
    setName('');
    setUsername('');
    setEmail('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    setRole('volunteer');
    setValidationErrors({});
    setOtpStage(false);
    setOtp('');
    setConfirmationResult(null);
    setShowSignInAfterOtp(false);
  };

  const inputBase =
    'block w-full pl-10 pr-4 py-3 rounded-lg bg-white border text-gray-800 text-sm outline-none transition-all';
  const inputNormal = `${inputBase} border-orange-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-200`;
  const inputError = `${inputBase} border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100`;

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #2C1004 0%, #4A1C00 50%, #2C1004 100%)' }}>
      <div id="signup-recaptcha" />
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center px-12 text-center">
        {/* Glowing Om */}
        <div className="relative mb-8">
          <img 
            src="/logo.jpg" 
            alt="Logo" 
            className="w-48 h-48 rounded-full shadow-2xl object-cover ring-8 ring-orange-500/50" 
            style={{ boxShadow: '0 0 60px 20px rgba(255,140,0,0.4)' }}
          />
        </div>

        <h1
          className="text-4xl lg:text-5xl font-extrabold mb-4 leading-tight text-center"
          style={{ color: '#FFD580', fontFamily: 'Georgia, serif', textShadow: '0 2px 16px rgba(255,200,0,0.4)' }}
        >
          శ్రీ వరసిద్ధి వినాయక భక్త బృందం
          <span className="text-2xl mt-4 block opacity-90 tracking-widest font-sans uppercase">
            - since 2008 -
          </span>
        </h1>
      </div>

      {/* Right Panel — Auth Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <div
          className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
          style={{ background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(10px)' }}
        >
          {/* Card Header */}
          <div className="pt-8 pb-4 px-8 text-center">
            {/* Mobile logo */}
            <div className="lg:hidden mb-4 flex justify-center">
              <img 
                src="/logo.jpg" 
                alt="Logo" 
                className="w-20 h-20 rounded-full shadow-lg object-cover ring-4 ring-orange-500/50" 
              />
            </div>
            <div className="flex items-center justify-center gap-2 mb-6">
              <span style={{ color: '#FF8C00', fontSize: '1.2rem' }}>🙏</span>
              <h2 className="text-2xl font-bold tracking-widest uppercase" style={{ color: '#2C1004', letterSpacing: '0.2em' }}>
                WELCOME
              </h2>
              <span style={{ color: '#FF8C00', fontSize: '1.2rem' }}>🙏</span>
            </div>

            {/* Tabs */}
            <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: '#F97316' }}>
              <button
                onClick={() => { setTab('login'); setResetMode(false); setLoginError(''); setInfoMsg(''); }}
                className="flex-1 py-2.5 text-sm font-bold transition-all"
                style={
                  tab === 'login'
                    ? { background: '#F97316', color: '#fff' }
                    : { background: '#FFF7ED', color: '#9A3412' }
                }
              >
                Login
              </button>
              <button
                onClick={() => { setTab('signup'); setSignupError(''); setSignupSuccess(''); setOtpStage(false); setOtp(''); setShowSignInAfterOtp(false); }}
                className="flex-1 py-2.5 text-sm font-bold transition-all"
                style={
                  tab === 'signup'
                    ? { background: '#F97316', color: '#fff' }
                    : { background: '#FFF7ED', color: '#9A3412' }
                }
              >
                Signup
              </button>
            </div>
          </div>

          {/* ── LOGIN TAB ────────────────────────────────── */}
          {tab === 'login' && (
            <div className="px-8 pb-8">
              {infoMsg && (
                <div className="mb-4 p-3 rounded-lg bg-orange-50 border border-orange-200 text-orange-800 text-sm text-center font-medium">
                  {infoMsg}
                </div>
              )}
              {loginError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm text-center font-medium">
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4" noValidate>
                {/* Email or Username */}
                <div>
                  <label className="block text-xs font-bold mb-1 tracking-widest uppercase" style={{ color: '#7C2D12' }}>
                    Email OR Username OR Phone
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-4 w-4 text-orange-400" />
                    </div>
                    <input
                      type="text"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className={inputNormal}
                      placeholder=""
                    />
                  </div>
                </div>


                {/* Password only if not resetting */}
                {!resetMode && (
                  <div>
                    <label className="block text-xs font-bold mb-1 tracking-widest uppercase" style={{ color: '#7C2D12' }}>
                      PASSWORD
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-4 w-4 text-orange-400" />
                      </div>
                      <input
                        type={showLoginPwd ? 'text' : 'password'}
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className={`${inputNormal} pr-10`}
                        placeholder=""
                      />
                      <button
                        type="button"
                        onClick={() => setShowLoginPwd(!showLoginPwd)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-orange-400 hover:text-orange-600"
                      >
                        {showLoginPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {/* Login Button */}
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all mt-2"
                  style={{ background: loginLoading ? '#FB923C' : 'linear-gradient(90deg, #EA580C, #F97316)', boxShadow: '0 4px 15px rgba(249,115,22,0.4)' }}
                >
                  {loginLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>{resetMode ? 'Send Reset Link' : '🙏 Login'}</>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-orange-100" />
                <span className="text-xs text-orange-300 font-medium">OR</span>
                <div className="flex-1 h-px bg-orange-100" />
              </div>

              {/* Google */}
              <button
                onClick={handleGoogle}
                disabled={loginLoading}
                className="w-full py-3 rounded-xl border font-semibold text-sm flex items-center justify-center gap-3 hover:bg-orange-50 transition-all"
                style={{ borderColor: '#FED7AA', color: '#7C2D12' }}
              >
                <svg className="w-5 h-5" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Continue with Google
              </button>

              <p className="text-center text-xs mt-4" style={{ color: '#F97316' }}>
                {resetMode ? (
                  <button onClick={() => setResetMode(false)} className="hover:underline text-gray-500 font-semibold">Back to Login</button>
                ) : (
                  <button onClick={() => setResetMode(true)} className="hover:underline font-semibold text-[#F97316]">Forgot Password?</button>
                )}
              </p>
            </div>
          )}

          {/* ── SIGNUP TAB ───────────────────────────────── */}
          {tab === 'signup' && (
            <div className="px-8 pb-8 max-h-[70vh] overflow-y-auto">
              {signupSuccess && (
                <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm font-medium text-center">
                  ✅ {signupSuccess}
                </div>
              )}
              {signupError && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium text-center">
                  {signupError}
                </div>
              )}

              {showSignInAfterOtp ? (
                <button
                  type="button"
                  onClick={() => {
                    setInfoMsg('Registration submitted. Please sign in after admin approval.');
                    setTab('login');
                    resetSignup();
                  }}
                  className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all mt-2"
                  style={{ background: 'linear-gradient(90deg, #EA580C, #F97316)', boxShadow: '0 4px 15px rgba(249,115,22,0.4)' }}
                >
                  Sign In
                </button>
              ) : (
              <form onSubmit={handleSignup} className="space-y-4" noValidate>
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold mb-1 tracking-widest uppercase" style={{ color: '#7C2D12' }}>
                    Full Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-4 w-4 text-orange-400" />
                    </div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => { setName(e.target.value); if (validationErrors.name) setValidationErrors({ ...validationErrors, name: '' }); }}
                      className={validationErrors.name ? inputError : inputNormal}
                      placeholder=""
                    />
                  </div>
                  {validationErrors.name && <p className="mt-1 text-xs text-red-500">{validationErrors.name}</p>}
                </div>
                
                {/* Username */}
                <div>
                  <label className="block text-xs font-bold mb-1 tracking-widest uppercase" style={{ color: '#7C2D12' }}>
                    Username
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-4 w-4 text-orange-400" />
                    </div>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => { setUsername(e.target.value.toLowerCase().replace(/\s/g, '')); if (validationErrors.username) setValidationErrors({ ...validationErrors, username: '' }); }}
                      className={validationErrors.username ? inputError : inputNormal}
                      placeholder=""
                    />
                  </div>
                  {validationErrors.username && <p className="mt-1 text-xs text-red-500">{validationErrors.username}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-bold mb-1 tracking-widest uppercase" style={{ color: '#7C2D12' }}>
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-4 w-4 text-orange-400" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); if (validationErrors.email) setValidationErrors({ ...validationErrors, email: '' }); }}
                      className={validationErrors.email ? inputError : inputNormal}
                      placeholder=""
                    />
                  </div>
                  {validationErrors.email && <p className="mt-1 text-xs text-red-500">{validationErrors.email}</p>}
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold mb-1 tracking-widest uppercase" style={{ color: '#7C2D12' }}>
                    Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Phone className="h-4 w-4 text-orange-400" />
                    </div>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '');
                        if (v.length <= 10) setPhone(v);
                        if (validationErrors.phone) setValidationErrors({ ...validationErrors, phone: '' });
                      }}
                      className={validationErrors.phone ? inputError : inputNormal}
                      placeholder=""
                    />
                  </div>
                  {validationErrors.phone && <p className="mt-1 text-xs text-red-500">{validationErrors.phone}</p>}
                </div>

                {/* Role */}
                <div>
                  <label className="block text-xs font-bold mb-1 tracking-widest uppercase" style={{ color: '#7C2D12' }}>
                    Role
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Shield className="h-4 w-4 text-orange-400" />
                    </div>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as any)}
                      className={`${inputNormal} cursor-pointer appearance-none`}
                      disabled={!limitsLoaded}
                    >
                      <option value="volunteer">Volunteer</option>
                      <option
                        value="admin"
                        disabled={isRoleFull('admin')}
                      >
                        Admin{isRoleFull('admin') ? ' (Full — 5/5)' : ` (${roleLimits.admin}/5 slots)`}
                      </option>
                      <option
                        value="super_admin"
                        disabled={isRoleFull('super_admin')}
                      >
                        Super Admin{isRoleFull('super_admin') ? ' (Full — 1/1)' : ` (${roleLimits.super_admin}/1 slot)`}
                      </option>
                    </select>
                  </div>
                  {(role === 'admin' || role === 'super_admin') && (
                    <p className="mt-1 text-xs text-orange-600 font-medium">
                      ⚠️ {role === 'super_admin' ? 'Super Admin' : 'Admin'} registration requires manual approval.
                    </p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold mb-1 tracking-widest uppercase" style={{ color: '#7C2D12' }}>
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-orange-400" />
                    </div>
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); if (validationErrors.password) setValidationErrors({ ...validationErrors, password: '' }); }}
                      className={`${validationErrors.password ? inputError : inputNormal} pr-10`}
                      placeholder=""
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-orange-400 hover:text-orange-600"
                    >
                      {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {validationErrors.password && <p className="mt-1 text-xs text-red-500">{validationErrors.password}</p>}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-xs font-bold mb-1 tracking-widest uppercase" style={{ color: '#7C2D12' }}>
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-4 w-4 text-orange-400" />
                    </div>
                    <input
                      type={showConfirmPwd ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); if (validationErrors.confirmPassword) setValidationErrors({ ...validationErrors, confirmPassword: '' }); }}
                      className={`${validationErrors.confirmPassword ? inputError : inputNormal} pr-10`}
                      placeholder=""
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-orange-400 hover:text-orange-600"
                    >
                      {showConfirmPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {validationErrors.confirmPassword && <p className="mt-1 text-xs text-red-500">{validationErrors.confirmPassword}</p>}
                </div>

                {/* Submit / OTP Details */}
                {!otpStage ? (
                  <button
                    type="submit"
                    disabled={signupLoading || !limitsLoaded}
                    className="w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all mt-2"
                    style={{
                      background: signupLoading ? '#FB923C' : 'linear-gradient(90deg, #EA580C, #F97316)',
                      boxShadow: '0 4px 15px rgba(249,115,22,0.4)',
                    }}
                  >
                    {signupLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      'Send OTP'
                    )}
                  </button>
                ) : (
                  <div className="mt-4 p-4 border border-orange-200 rounded-xl bg-orange-50">
                    <label className="block text-xs font-bold mb-1 tracking-widest uppercase text-center" style={{ color: '#7C2D12' }}>
                      Enter 6-Digit OTP
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setOtp(val);
                      }}
                      className={`${inputNormal} text-center text-xl tracking-widest font-mono font-bold`}
                      placeholder=""
                    />
                    <button
                      type="submit"
                      disabled={signupLoading || otp.length !== 6}
                      className="mt-4 w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                      style={{ background: 'linear-gradient(90deg, #EA580C, #F97316)' }}
                    >
                      {signupLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Verify OTP'}
                    </button>
                    {signupLoading && (
                      <div className="flex justify-center mt-2">
                        <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                      </div>
                    )}
                  </div>
                )}
              </form>
              )}

              {/* Google Signup */}
              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px bg-orange-100" />
                <span className="text-xs text-orange-300 font-medium">OR</span>
                <div className="flex-1 h-px bg-orange-100" />
              </div>
              <button
                onClick={handleGoogle}
                disabled={signupLoading}
                className="w-full py-3 rounded-xl border font-semibold text-sm flex items-center justify-center gap-3 hover:bg-orange-50 transition-all"
                style={{ borderColor: '#FED7AA', color: '#7C2D12' }}
              >
                <svg className="w-5 h-5" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                Sign up with Google
              </button>
            </div>
          )}
          {/* ── GOOGLE PROFILE MODAL ───────────────────────── */}
          {pendingGoogleUser && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Complete Profile</h2>
                <div className="space-y-4">
                  {loginError && <p className="text-xs text-red-600 font-bold">{loginError}</p>}
                  
                  <div>
                    <label className="block text-xs font-bold mb-1 text-gray-700">Username</label>
                    <input 
                      type="text" 
                      value={gUsername} 
                      onChange={e => setGUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} 
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-400" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 text-gray-700">Phone Number</label>
                    <input 
                      type="tel" 
                      value={gPhone} 
                      onChange={e => { const val = e.target.value.replace(/\D/g, ''); if(val.length <= 10) setGPhone(val); }} 
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-400" 
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold mb-1 text-gray-700">Role Request</label>
                    <select 
                      value={gRole} 
                      onChange={(e) => setGRole(e.target.value as any)} 
                      className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-400"
                    >
                      <option value="volunteer">Volunteer</option>
                      <option value="admin" disabled={isRoleFull('admin')}>Admin {isRoleFull('admin') ? '(Full)' : ''}</option>
                      <option value="super_admin" disabled={isRoleFull('super_admin')}>Super Admin {isRoleFull('super_admin') ? '(Full)' : ''}</option>
                    </select>
                  </div>

                  <button 
                    onClick={submitGoogleProfile}
                    disabled={loginLoading}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50"
                  >
                    {loginLoading ? 'Saving...' : 'Finish Signup'}
                  </button>
                  <button 
                    onClick={() => { setPendingGoogleUser(null); firebaseSignOut(auth); }}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
