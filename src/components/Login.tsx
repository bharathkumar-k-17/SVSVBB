/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef } from 'react';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    ConfirmationResult,
    sendEmailVerification,
    signOut as firebaseSignOut,
    GoogleAuthProvider,
    signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Mail, Lock, User, Phone, ShieldCheck, MailOpen, AlertCircle, Eye, EyeOff } from 'lucide-react';

export const Login = () => {
    const { user } = useAuth();
    // Flow states: 'login', 'signup', 'otp'
    const [view, setView] = useState<'login' | 'signup' | 'otp'>('login');

    // Form fields
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [phone, setPhone] = useState('');
    // OTP logic variables
    const [otp, setOtp] = useState(['', '', '', '', '', '']);
    const [generatedOtp, setGeneratedOtp] = useState('');
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    const [signupRole, setSignupRole] = useState('SUPER_ADMIN');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        document.body.style.backgroundColor = '#2c1204';
        return () => {
            document.body.style.backgroundColor = 'var(--background, #fff)';
        };
    }, []);

    if (user) {
        return <Navigate to="/dashboard" replace />;
    }

    const handleGoogleLogin = async () => {
        setLoading(true);
        setError('');
        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            const user = result.user;

            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (!userDoc.exists()) {
                await setDoc(doc(db, 'users', user.uid), {
                    name: user.displayName || 'Google User',
                    email: user.email,
                    phone: user.phoneNumber || '',
                    role: 'VOLUNTEER',
                    status: 'pending',
                    createdAt: new Date().toISOString()
                });
                await firebaseSignOut(auth);
                alert("Account created. Please wait for an Admin to approve your account before you can log in.");
            }
        } catch (err: Error | any) {
            console.error(err);
            setError(err.message || "Google Login Failed");
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err: Error | any) {
            console.error("Login Error:", err);
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    const handleSignupRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (password.length < 6) {
                throw new Error("Password must be at least 6 characters");
            }

            // Generate a 6-digit OTP
            const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
            setGeneratedOtp(newOtp);

            // Trigger email using Firebase Extension
            try {
                const { triggerEmail } = await import('../lib/email');
                await triggerEmail({
                    to: email,
                    message: {
                        subject: "Your Registration OTP",
                        html: `<h3>Your Verification Code is: ${newOtp}</h3>`,
                        text: `Your Verification Code is: ${newOtp}`
                    }
                });
            } catch (e) {
                console.error("Failed to queue email. Ensure Firebase Extension is configured.", e);
            }

            // Provide visual feedback / mocked email for testing
            alert(`[DEV SIMULATION]\nAn OTP would typically arrive in your email now.\n\nYour OTP is: ${newOtp}\n\n(A real email was also queued if Firebase 'Trigger Email' extension is active on the 'mail' collection)`);

            setView('otp');

        } catch (err: Error | any) {
            console.error("Signup Request Error:", err);
            setError(err.message || 'Failed to request OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        // Auto focus next input
        if (value && index < 5) {
            otpRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace' && !otp[index] && index > 0) {
            otpRefs.current[index - 1]?.focus();
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const enteredOtp = otp.join('');
        if (enteredOtp !== generatedOtp) {
            setError('Invalid OTP code. Please try again.');
            setLoading(false);
            return;
        }

        try {
            // OTP is correct! Now create account.
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);

            // Determine status based on role: only volunteers need approval.
            const accountStatus = signupRole === 'VOLUNTEER' ? 'pending' : 'approved';

            await setDoc(doc(db, 'users', userCredential.user.uid), {
                name: name,
                email: email,
                phone: phone,
                role: signupRole,
                status: accountStatus,
                createdAt: new Date().toISOString()
            });

            await sendEmailVerification(userCredential.user);

            if (accountStatus === 'pending') {
                await firebaseSignOut(auth);
                alert("Account created successfully. Your account is pending Admin approval.");
                setView('login');
            } else {
                alert(`Account created successfully! Welcome, ${signupRole}.`);
                // They can remain logged in as they are approved.
                // Re-route happens via AuthContext / user effect.
            }

        } catch (err: Error | any) {
            console.error(err);
            setError(err.message || 'Failed to complete registration.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex flex-col items-center py-10 px-4 bg-gradient-to-b from-[#2c1204] to-[#1a0a02] font-sans md:flex-row md:justify-center md:gap-16">

            {/* Top Header / Left Branding */}
            <div className="flex flex-col items-center justify-center shrink-0 w-full md:w-auto mb-10 md:mb-0 z-10 transition-all duration-700 ease-in-out transform">

                {/* Glowing Logo Circle */}
                <div className="relative mb-6 group">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-orange-500/30 blur-2xl animate-pulse"></div>
                    <div className="relative w-28 h-28 rounded-full border-[3px] border-amber-400 flex justify-center items-center bg-gradient-to-br from-violet-700 to-indigo-900 shadow-[0_0_30px_rgba(245,158,11,0.4)] overflow-hidden">
                        <span className="text-6xl text-white pt-1">ॐ</span>
                    </div>
                </div>

                <h1 className="text-amber-500 text-center font-serif tracking-widest leading-relaxed text-[1.4rem] md:text-[1.8rem] mb-3 max-w-sm px-4 whitespace-nowrap overflow-hidden text-ellipsis drop-shadow-md">
                    శ్రీ వరసిద్ధి వినాయక భక్త బృందం
                </h1>

                <p className="text-gray-300 text-sm md:text-base tracking-[0.2em] uppercase font-medium mt-1">
                    Since 2008
                </p>
            </div>

            {/* Card Container constraints */}
            <div className="w-full max-w-md shrink-0">
                <div className="bg-white/95 backdrop-blur-sm rounded-[2rem] p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-white/20 relative z-10 overflow-hidden">

                    {/* Header */}
                    <div className="text-center mb-8">
                        <h2 className="text-orange-600 text-2xl font-bold font-serif tracking-wide uppercase flex items-center justify-center gap-2">
                            <span className="text-2xl pt-1">🙏</span> WELCOME
                        </h2>
                    </div>

                    {error && (
                        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 animate-in fade-in slide-in-from-top-4">
                            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-600 font-medium leading-tight">{error}</p>
                        </div>
                    )}

                    {/* LOGIN VIEW */}
                    {view === 'login' && (
                        <div className="animate-in fade-in zoom-in-95 duration-300">

                            <button
                                type="button"
                                onClick={handleGoogleLogin}
                                disabled={loading}
                                className="w-full bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold py-3.5 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-3 mb-6"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Login with Google
                            </button>

                            <div className="relative flex items-center mb-6">
                                <div className="flex-grow border-t border-gray-200"></div>
                                <span className="flex-shrink-0 mx-4 text-gray-400 text-sm font-medium">OR</span>
                                <div className="flex-grow border-t border-gray-200"></div>
                            </div>

                            <form onSubmit={handleLogin}>
                                <div className="relative mb-5 group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
                                    </div>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full pl-11 pr-4 py-3.5 rounded-2xl border-2 border-gray-100 bg-gray-50/50 text-gray-800 placeholder-gray-400 outline-none focus:border-amber-400 focus:bg-white transition-all duration-300"
                                        placeholder=""
                                    />
                                </div>

                                <div className="relative mb-8 group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
                                    </div>
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        className="w-full pl-11 pr-12 py-3.5 rounded-2xl border-2 border-gray-100 bg-gray-50/50 text-gray-800 placeholder-gray-400 outline-none focus:border-amber-400 focus:bg-white transition-all duration-300"
                                        placeholder=""
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-500/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                >
                                    {loading ? 'Logging in...' : 'Login'}
                                </button>
                            </form>

                            <div className="mt-6 text-center space-y-4">
                                <button className="text-orange-600 hover:text-orange-700 text-sm font-medium transition-colors hover:underline">
                                    Forgot Password?
                                </button>

                                <div className="text-sm text-gray-500">
                                    Don't have an account?{' '}
                                    <button
                                        onClick={() => setView('signup')}
                                        className="text-orange-600 hover:text-orange-700 font-bold ml-1 hover:underline transition-colors"
                                    >
                                        Sign Up
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* SIGNUP VIEW */}
                    {view === 'signup' && (
                        <div className="animate-in fade-in zoom-in-95 duration-300">
                            <h3 className="text-xl font-bold text-gray-800 text-center mb-6">Create Account</h3>

                            <form onSubmit={handleSignupRequest} className="space-y-4">
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <User className="h-5 w-5 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
                                    </div>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                        className="w-full pl-11 pr-4 py-3.5 rounded-xl border-2 border-gray-100 bg-gray-50/50 text-gray-800 placeholder-gray-400 outline-none focus:border-amber-400 focus:bg-white transition-all duration-300"
                                        placeholder=""
                                    />
                                </div>

                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Phone className="h-5 w-5 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
                                    </div>
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        required
                                        className="w-full pl-11 pr-4 py-3.5 rounded-xl border-2 border-gray-100 bg-gray-50/50 text-gray-800 placeholder-gray-400 outline-none focus:border-amber-400 focus:bg-white transition-all duration-300"
                                        placeholder=""
                                    />
                                </div>

                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                        <Mail className="h-5 w-5 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
                                    </div>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full pl-11 pr-4 py-3.5 rounded-xl border-2 border-gray-100 bg-gray-50/50 text-gray-800 placeholder-gray-400 outline-none focus:border-amber-400 focus:bg-white transition-all duration-300"
                                        placeholder=""
                                    />
                                </div>

                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                                        <ShieldCheck className="h-5 w-5 text-gray-400 group-focus-within:text-orange-500 transition-colors" />
                                    </div>
                                    <select
                                        value={signupRole}
                                        onChange={(e) => setSignupRole(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3.5 rounded-xl border-2 border-gray-100 bg-gray-50/50 text-gray-800 outline-none focus:border-amber-400 focus:bg-white transition-all duration-300 uppercase text-sm font-semibold tracking-wide appearance-none"
                                    >
                                        <option value="SUPER_ADMIN">Super Admin</option>
                                        <option value="ADMIN">Admin</option>
                                        <option value="VOLUNTEER">Volunteer</option>
                                    </select>
                                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full mt-4 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-500/30 active:scale-[0.98] transition-all flex items-center justify-center"
                                >
                                    {loading ? 'Processing...' : 'Send OTP to Verify'}
                                </button>
                            </form>

                            <div className="mt-6 text-center">
                                <button
                                    onClick={() => setView('login')}
                                    className="text-gray-500 hover:text-orange-600 text-sm font-medium transition-colors"
                                >
                                    Back to Login
                                </button>
                            </div>
                        </div>
                    )}

                    {/* OTP VIEW */}
                    {view === 'otp' && (
                        <div className="animate-in fade-in zoom-in-95 duration-300 text-center">
                            <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-6">
                                <MailOpen className="h-8 w-8 text-orange-500" />
                            </div>

                            <h3 className="text-xl font-bold text-gray-800 mb-2">Verify Email</h3>
                            <p className="text-gray-500 text-sm mb-8 px-4 leading-relaxed">
                                Enter the 6-digit OTP sent to your email address <br />
                                <strong className="text-gray-700">{email}</strong>
                            </p>

                            <form onSubmit={handleVerifyOtp} className="space-y-8">
                                <div className="flex justify-center gap-2">
                                    {otp.map((digit, index) => (
                                        <input
                                            key={index}
                                            ref={el => otpRefs.current[index] = el}
                                            type="text"
                                            maxLength={1}
                                            value={digit}
                                            onChange={(e) => handleOtpChange(index, e.target.value)}
                                            onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                            className="w-12 h-14 text-center text-2xl font-bold rounded-xl border-2 border-gray-200 focus:border-amber-500 focus:bg-orange-50 outline-none transition-all shadow-sm"
                                        />
                                    ))}
                                </div>

                                <div className="space-y-4">
                                    <button
                                        type="submit"
                                        disabled={loading || otp.join('').length !== 6}
                                        className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-500/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? 'Verifying...' : 'Verify OTP & Create Account'}
                                    </button>

                                    <button
                                        type="button"
                                        className="text-orange-600 hover:text-orange-700 font-medium text-sm transition-colors hover:underline"
                                    >
                                        Resend OTP
                                    </button>
                                </div>
                            </form>

                            <div className="mt-8">
                                <button
                                    onClick={() => setView('signup')}
                                    className="text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors"
                                >
                                    Change email address
                                </button>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

