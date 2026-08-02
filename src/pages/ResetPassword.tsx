import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Shield, KeyRound, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      
      toast.success('Password updated successfully! Please login again.');
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #2C1004 0%, #4A1C00 50%, #2C1004 100%)' }}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative overflow-hidden">
        
        {/* Header */}
        <div className="text-center mb-8 relative z-10">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-200 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-inner">
            <KeyRound className="text-orange-600" size={32} />
          </div>
          <h2 className="text-3xl font-black text-gray-900 mb-2 font-display">
            Set New Password
          </h2>
          <p className="text-gray-500 font-medium">
            Please enter your new secure password.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleUpdatePassword} className="space-y-5 relative z-10">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
              New Password
            </label>
            <div className="relative">
              <Shield size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all font-medium"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
              Confirm Password
            </label>
            <div className="relative">
              <Shield size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none transition-all font-medium"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl font-bold shadow-lg shadow-orange-500/30 transform hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2 uppercase tracking-wide disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Updating...
              </>
            ) : (
              'Update Password'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
