"use client";

import React, { useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Lock, Eye, EyeOff, Phone as PhoneIcon, AlertTriangle, Check, KeyRound,
} from 'lucide-react';
import { api } from '@/lib/api';

/* ───────────────────── Phone Utilities ───────────────────── */
function normalizePhone(raw: string): string {
  let clean = raw.trim().replace(/\D/g, '');
  if (clean.startsWith('251')) clean = clean.substring(3);
  if (clean.startsWith('0')) clean = clean.substring(1);
  return `+251${clean}`;
}

function isValidEthiopian(phone: string): boolean {
  const clean = phone.replace(/\D/g, '');
  return /^2519\d{8}$/.test(clean);
}

/* ───────────────────── Step Indicator ───────────────────── */
function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = [
    { num: 1, label: 'Phone' },
    { num: 2, label: 'OTP' },
    { num: 3, label: 'New Password' },
  ];

  return (
    <div className="flex items-center justify-center gap-0 mb-7">
      {steps.map((s, i) => (
        <React.Fragment key={s.num}>
          <div className="flex flex-col items-center">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                currentStep >= s.num
                  ? 'bg-[#025EA7] text-white'
                  : 'bg-slate-200 text-slate-400'
              }`}
            >
              {currentStep > s.num ? <Check className="w-3.5 h-3.5" /> : s.num}
            </div>
            <span
              className={`text-[10px] mt-1 font-medium transition-colors ${
                currentStep >= s.num ? 'text-[#025EA7]' : 'text-slate-400'
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`w-10 h-0.5 mb-4 transition-colors duration-300 ${
                currentStep > s.num ? 'bg-[#025EA7]' : 'bg-slate-200'
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ───────────────────── Forgot Password Page ───────────────────── */
export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={
      <div className="stock-chart-bg min-h-screen w-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ForgotPasswordInner />
    </Suspense>
  );
}

function ForgotPasswordInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Phone
  const [phone, setPhone] = useState(searchParams.get('phone') || '');

  // Step 2: OTP
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Step 3: New Password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const getFullPhone = () => normalizePhone(phone);

  /* ─── Step 1: Send OTP ────────────────────── */
  const handleSendOtp = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);

    const fullPhone = getFullPhone();
    if (!isValidEthiopian(fullPhone)) {
      setError('Please enter a valid Ethiopian phone number');
      return;
    }

    setLoading(true);
    try {
      await api.sendOtp(fullPhone);
      setDigits(['', '', '', '', '', '']);
      setStep(2);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err: any) {
      setError(err?.message?.replace('Exception: ', '') || 'Failed to send code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  /* ─── Step 2: Verify OTP ────────────────────── */
  const handleVerifyOtp = async (code?: string) => {
    const otp = code || digits.join('');
    if (otp.length < 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const fullPhone = getFullPhone();
      await api.verifyOtp(fullPhone, otp);
      setStep(3);
      setTimeout(() => passwordRef.current?.focus(), 100);
    } catch (err: any) {
      setError(err?.message?.replace('Exception: ', '') || 'Invalid or expired OTP code');
      clearOtp();
    } finally {
      setLoading(false);
    }
  };

  /* ─── Step 3: Reset Password ────────────────────── */
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (newPassword.length > 32) {
      setError('Password must be at most 32 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const fullPhone = getFullPhone();
      const otp = digits.join('');
      await api.resetPassword(fullPhone, otp, newPassword);

      // Success — redirect to login
      router.push('/login');
    } catch (err: any) {
      const message = err?.message || 'Reset failed';
      const isOtpError = message.toLowerCase().includes('otp') || message.toLowerCase().includes('code');

      if (isOtpError) {
        // OTP expired — re-send and go back to step 2
        setError('Your verification code has expired. Sending a new code...');
        setStep(2);
        clearOtp();
        try {
          await api.sendOtp(getFullPhone());
          setError('A new verification code has been sent. Please enter it to continue.');
        } catch {
          setError('Failed to resend code. Please try again.');
        }
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  /* ─── OTP Input Handlers ────────────────────── */
  const handleDigitChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setError(null);

    if (digit && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    if (digit && index === 5) {
      const allFilled = newDigits.every((d) => d !== '');
      if (allFilled && !loading) {
        handleVerifyOtp(newDigits.join(''));
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newDigits = [...digits];
      for (let i = 0; i < 6; i++) newDigits[i] = pasted[i] || '';
      setDigits(newDigits);
      const focusIdx = Math.min(pasted.length, 5);
      otpRefs.current[focusIdx]?.focus();
      if (pasted.length === 6 && !loading) handleVerifyOtp(pasted);
    }
  };

  const clearOtp = () => {
    setDigits(['', '', '', '', '', '']);
    setTimeout(() => otpRefs.current[0]?.focus(), 50);
  };

  /* ─── Back handler ────────────────────── */
  const handleBack = () => {
    if (step > 1) {
      setStep((s) => s - 1);
      setError(null);
    } else {
      router.back();
    }
  };

  /* ─── Titles ────────────────────── */
  const title = step === 1 ? 'Reset Password' : step === 2 ? 'Verify OTP' : 'Set New Password';
  const subtitle =
    step === 1
      ? 'Enter your phone number to receive a verification code'
      : step === 2
      ? `Enter the 6-digit code sent to ${getFullPhone()}`
      : 'Create your new password';

  return (
    <div className="stock-chart-bg min-h-screen w-full flex items-center justify-center p-4">
      <div className="w-full max-w-[460px] bg-white rounded-[24px] shadow-2xl p-8 md:p-10 relative z-10 animate-fade-in border border-white/20">

        {/* Back Button */}
        <button
          type="button"
          onClick={handleBack}
          className="absolute top-8 left-8 text-slate-400 hover:text-slate-700 transition-colors p-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
            <KeyRound className="w-8 h-8 text-[#025EA7]" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
          <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
        </div>

        {/* Step Indicator */}
        <StepIndicator currentStep={step} />

        {/* Error */}
        {error && (
          <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-red-600 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* ═══════ STEP 1: Phone ═══════ */}
        {step === 1 && (
          <form onSubmit={handleSendOtp} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Phone Number</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <PhoneIcon className="w-5 h-5" />
                </div>
                <div className="absolute inset-y-0 left-10 flex items-center pointer-events-none text-slate-500 font-medium text-sm">
                  +251
                </div>
                <input
                  id="forgot-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(e.target.value); setError(null); }}
                  placeholder="912345678"
                  required
                  className="w-full pl-24 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#025EA7]/30 focus:border-[#025EA7] transition-all text-sm font-medium"
                />
              </div>
            </div>

            <button
              id="forgot-send-btn"
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-[#025EA7] hover:bg-[#014883] active:scale-[0.99] text-white font-semibold rounded-xl shadow-lg shadow-blue-900/20 transition-all text-sm flex items-center justify-center disabled:opacity-60"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Send Verification Code'
              )}
            </button>
          </form>
        )}

        {/* ═══════ STEP 2: OTP ═══════ */}
        {step === 2 && (
          <div className="space-y-5">
            {/* 6-digit input boxes */}
            <div className="flex justify-center gap-2.5 sm:gap-3" onPaste={handlePaste}>
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleDigitChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  placeholder="-"
                  className={`w-11 h-14 sm:w-12 sm:h-[60px] text-center text-xl font-bold rounded-xl border-2 transition-all focus:outline-none
                    ${error
                      ? 'bg-red-50 border-red-300 text-red-900 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                      : 'bg-white border-slate-200 text-slate-900 focus:border-[#025EA7] focus:ring-2 focus:ring-[#025EA7]/20'
                    }`}
                />
              ))}
            </div>

            <button
              id="forgot-verify-btn"
              type="button"
              onClick={() => handleVerifyOtp()}
              disabled={loading}
              className="w-full py-3.5 px-4 bg-[#025EA7] hover:bg-[#014883] active:scale-[0.99] text-white font-semibold rounded-xl shadow-lg shadow-blue-900/20 transition-all text-sm flex items-center justify-center disabled:opacity-60"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Verify & Continue'
              )}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={loading ? undefined : () => handleSendOtp()}
                className="text-sm text-[#025EA7] font-semibold hover:underline"
              >
                Resend Code
              </button>
            </div>
          </div>
        )}

        {/* ═══════ STEP 3: New Password ═══════ */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">New Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  ref={passwordRef}
                  id="forgot-new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setError(null); }}
                  placeholder="Enter your new password"
                  maxLength={32}
                  required
                  className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#025EA7]/30 focus:border-[#025EA7] transition-all text-sm font-medium"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-900 mb-2">Confirm New Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  id="forgot-confirm-password"
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                  placeholder="Re-enter your new password"
                  maxLength={32}
                  required
                  className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#025EA7]/30 focus:border-[#025EA7] transition-all text-sm font-medium"
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600">
                  {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              id="forgot-reset-btn"
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-[#025EA7] hover:bg-[#014883] active:scale-[0.99] text-white font-semibold rounded-xl shadow-lg shadow-blue-900/20 transition-all text-sm flex items-center justify-center disabled:opacity-60"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Reset Password'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
