'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  ShieldCheck,
  Mail,
  Lock,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';

type Step = 'email' | 'otp' | 'newPassword' | 'success';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [canResend, setCanResend] = useState(false);

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown <= 0) {
      setCanResend(true);
      return;
    }
    setCanResend(false);
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  // Auto-focus first OTP input when entering OTP step
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    }
  }, [step]);

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value;
    setOtpDigits(newDigits);

    // Auto-advance to next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtpDigits(pasted.split(''));
      otpInputRefs.current[5]?.focus();
    }
  };

  const otpCode = otpDigits.join('');

  // Step 1: Request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const data = await api.post('/auth/admin-forgot-password', { email });
      if (data.code) {
        setDevCode(data.code);
      }
      setCountdown(60);
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (!canResend) return;
    setSubmitting(true);
    setError('');
    setDevCode(null);
    setOtpDigits(['', '', '', '', '', '']);

    try {
      const data = await api.post('/auth/admin-forgot-password', { email });
      if (data.code) {
        setDevCode(data.code);
      }
      setCountdown(60);
      otpInputRefs.current[0]?.focus();
    } catch (err: any) {
      setError(err.message || 'Failed to resend code.');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length !== 6) {
      setError('Please enter the complete 6-digit code');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await api.post('/auth/admin-verify-otp', { email, code: otpCode });
      setStep('newPassword');
    } catch (err: any) {
      setError(err.message || 'Invalid or expired verification code.');
    } finally {
      setSubmitting(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      await api.post('/auth/admin-reset-password', {
        email,
        code: otpCode,
        newPassword,
      });
      setStep('success');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-[#025EA7] p-8 text-white text-center relative">
          <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/20 shadow-inner">
            {step === 'success' ? (
              <CheckCircle2 className="w-9 h-9 text-white" />
            ) : (
              <ShieldCheck className="w-9 h-9 text-white" />
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight">BM Stock</h1>
          <p className="text-blue-100 text-sm mt-1 font-medium">
            {step === 'email' && 'Forgot Password'}
            {step === 'otp' && 'Verify Your Email'}
            {step === 'newPassword' && 'Set New Password'}
            {step === 'success' && 'Password Reset Complete'}
          </p>

          {/* Step Indicator */}
          {step !== 'success' && (
            <div className="flex items-center justify-center mt-5 space-x-2">
              {(['email', 'otp', 'newPassword'] as Step[]).map((s, i) => (
                <React.Fragment key={s}>
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                      step === s
                        ? 'bg-white text-[#025EA7] scale-110 shadow-lg'
                        : (['email', 'otp', 'newPassword'] as Step[]).indexOf(step) > i
                          ? 'bg-white/30 text-white'
                          : 'bg-white/10 text-white/50'
                    }`}
                  >
                    {i + 1}
                  </div>
                  {i < 2 && (
                    <div
                      className={`w-8 h-0.5 rounded-full transition-all duration-300 ${
                        (['email', 'otp', 'newPassword'] as Step[]).indexOf(step) > i
                          ? 'bg-white/40'
                          : 'bg-white/10'
                      }`}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-8 bg-white">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start space-x-3 text-red-700 text-sm animate-fadeIn">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Dev mode code hint */}
          {devCode && step === 'otp' && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-mono text-center">
              <span className="font-bold">Dev Mode:</span> Your code is{' '}
              <span className="bg-amber-200 px-2 py-0.5 rounded font-bold tracking-widest">
                {devCode}
              </span>
            </div>
          )}

          {/* ── Step 1: Email ── */}
          {step === 'email' && (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <p className="text-slate-500 text-sm leading-relaxed">
                Enter the email address associated with your admin account. We&apos;ll send you a 6-digit verification code.
              </p>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Admin Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@example.com"
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#025EA7] focus:border-transparent outline-none transition text-slate-800 font-medium placeholder-slate-400"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-4 bg-[#025EA7] hover:bg-[#024A85] text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 hover:shadow-xl transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed group cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Sending Code...</span>
                  </>
                ) : (
                  <>
                    <span>Send Verification Code</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              <Link
                href="/login"
                className="flex items-center justify-center space-x-2 text-sm text-slate-500 hover:text-[#025EA7] transition mt-2 font-medium"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Sign In</span>
              </Link>
            </form>
          )}

          {/* ── Step 2: OTP Verification ── */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <p className="text-slate-500 text-sm leading-relaxed">
                We sent a 6-digit code to{' '}
                <span className="font-semibold text-slate-700">{email}</span>.
                Enter it below to verify your identity.
              </p>

              <div className="flex justify-center space-x-2">
                {otpDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => { otpInputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    onPaste={i === 0 ? handleOtpPaste : undefined}
                    className="w-12 h-14 text-center text-xl font-bold bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#025EA7] focus:border-transparent outline-none transition text-slate-800"
                  />
                ))}
              </div>

              {/* Countdown / Resend */}
              <div className="text-center">
                {canResend ? (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={submitting}
                    className="inline-flex items-center space-x-1.5 text-sm text-[#025EA7] hover:text-[#024A85] font-medium transition cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Resend Code</span>
                  </button>
                ) : (
                  <p className="text-xs text-slate-400">
                    Resend code in{' '}
                    <span className="font-semibold text-slate-500 font-mono">
                      {countdown}s
                    </span>
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || otpCode.length !== 6}
                className="w-full py-4 bg-[#025EA7] hover:bg-[#024A85] text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 hover:shadow-xl transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed group cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Verifying...</span>
                  </>
                ) : (
                  <>
                    <span>Verify Code</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setError('');
                  setDevCode(null);
                  setOtpDigits(['', '', '', '', '', '']);
                }}
                className="flex items-center justify-center space-x-2 text-sm text-slate-500 hover:text-[#025EA7] transition mt-2 font-medium mx-auto cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Change Email</span>
              </button>
            </form>
          )}

          {/* ── Step 3: New Password ── */}
          {step === 'newPassword' && (
            <form onSubmit={handleResetPassword} className="space-y-5">
              <p className="text-slate-500 text-sm leading-relaxed">
                Create a new password for your admin account. Make sure it&apos;s strong and secure.
              </p>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#025EA7] focus:border-transparent outline-none transition text-slate-800 font-medium placeholder-slate-400"
                    required
                    minLength={4}
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                    <KeyRound className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#025EA7] focus:border-transparent outline-none transition text-slate-800 font-medium placeholder-slate-400"
                    required
                    minLength={4}
                  />
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-500 mt-1.5 ml-1">Passwords do not match</p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || !newPassword || newPassword !== confirmPassword}
                className="w-full py-4 bg-[#025EA7] hover:bg-[#024A85] text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 hover:shadow-xl transition-all duration-200 flex items-center justify-center space-x-2 disabled:opacity-70 disabled:cursor-not-allowed group cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Resetting Password...</span>
                  </>
                ) : (
                  <>
                    <span>Reset Password</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* ── Step 4: Success ── */}
          {step === 'success' && (
            <div className="text-center space-y-5">
              <div className="w-20 h-20 bg-emerald-50 border-4 border-emerald-200 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-10 h-10 text-emerald-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800 mb-1">
                  Password Reset Successful!
                </h2>
                <p className="text-slate-500 text-sm">
                  Your admin password has been updated. You can now sign in with your new password.
                </p>
              </div>

              <Link
                href="/login"
                className="inline-flex items-center justify-center space-x-2 w-full py-4 bg-[#025EA7] hover:bg-[#024A85] text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 hover:shadow-xl transition-all duration-200 group"
              >
                <span>Sign In to Admin Portal</span>
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
