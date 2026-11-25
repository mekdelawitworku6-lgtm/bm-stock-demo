"use client";

import React, { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

/* ───────────────────── Phone Masking ───────────────────── */
function maskPhone(phone: string): string {
  if (phone.length > 6) {
    return `${phone.substring(0, 4)}*-****-${phone.substring(phone.length - 4)}`;
  }
  return phone;
}

/* ───────────────────── Verify Page ───────────────────── */
export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="stock-chart-bg min-h-screen w-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <VerifyPageInner />
    </Suspense>
  );
}

function VerifyPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register } = useAuth();

  // Decode registration data from URL
  const [regData, setRegData] = useState<Record<string, any> | null>(null);
  useEffect(() => {
    const encoded = searchParams.get('data');
    if (encoded) {
      try {
        setRegData(JSON.parse(atob(encoded)));
      } catch {
        router.push('/register');
      }
    } else {
      router.push('/register');
    }
  }, [searchParams, router]);

  const phone = regData?.phone || '';
  const masked = maskPhone(phone);

  // OTP state
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [dispatchedRegister, setDispatchedRegister] = useState(false);

  // Timer state (20 second countdown like Flutter)
  const [secondsRemaining, setSecondsRemaining] = useState(20);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (secondsRemaining <= 0) {
      setCanResend(true);
      return;
    }
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsRemaining]);

  // Auto-focus first input
  useEffect(() => {
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
  }, []);

  /* ─── Handle digit input ────────────────────── */
  const handleDigitChange = (index: number, value: string) => {
    // Only allow single digit
    const digit = value.replace(/\D/g, '').slice(-1);
    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);
    setError(null);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits filled
    if (digit && index === 5) {
      const allFilled = newDigits.every((d) => d !== '');
      if (allFilled && !loading) {
        handleVerify(newDigits.join(''));
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length > 0) {
      const newDigits = [...digits];
      for (let i = 0; i < 6; i++) {
        newDigits[i] = pasted[i] || '';
      }
      setDigits(newDigits);
      const focusIdx = Math.min(pasted.length, 5);
      inputRefs.current[focusIdx]?.focus();

      if (pasted.length === 6 && !loading) {
        handleVerify(pasted);
      }
    }
  };

  /* ─── Verify OTP ────────────────────── */
  const handleVerify = useCallback(async (code?: string) => {
    const otp = code || digits.join('');
    if (otp.length < 6) {
      setError('Please enter all 6 digits');
      return;
    }
    if (!regData || dispatchedRegister) return;

    setLoading(true);
    setError(null);

    try {
      const verified = await api.verifyOtp(phone, otp);
      if (!verified) {
        setError('Invalid or expired OTP code. Please try again.');
        setLoading(false);
        clearDigits();
        return;
      }

      // OTP verified — proceed to choose plan & payment screen (matching Flutter)
      setDispatchedRegister(true);
      setLoading(false);
      const params = new URLSearchParams();
      params.set('data', btoa(JSON.stringify(regData)));
      router.push(`/choose-plan?${params.toString()}`);
    } catch (err: any) {
      setLoading(false);
      setDispatchedRegister(false);
      setError(err?.message || 'Verification failed. Please try again.');
      clearDigits();
    }
  }, [digits, phone, regData, dispatchedRegister, register, router]);

  const clearDigits = () => {
    setDigits(['', '', '', '', '', '']);
    setTimeout(() => inputRefs.current[0]?.focus(), 50);
  };

  /* ─── Resend OTP ────────────────────── */
  const handleResend = async () => {
    if (!phone) return;
    setError(null);
    setSuccessInfo(null);
    try {
      await api.sendOtp(phone);
      setSecondsRemaining(20);
      setCanResend(false);
      setSuccessInfo('Verification code resent successfully!');
      clearDigits();
    } catch (err: any) {
      setError(err?.message || 'Failed to resend code. Please try again.');
    }
  };

  if (!regData) {
    return (
      <div className="stock-chart-bg min-h-screen w-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="stock-chart-bg min-h-screen w-full flex items-center justify-center p-4">
      <div className="w-full max-w-[460px] bg-white rounded-[24px] shadow-2xl p-8 md:p-10 relative z-10 animate-fade-in border border-white/20">

        {/* Back Button */}
        <button
          type="button"
          onClick={() => router.back()}
          className="absolute top-8 left-8 text-slate-400 hover:text-slate-700 transition-colors p-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Logo */}
        <div className="flex flex-col items-center mb-8 text-center">
          <img
            src="/logo/gelagle_logo_horizontal.png"
            alt="BM Stock Logo"
            className="h-12 object-contain mb-3"
            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
          />
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Verify Your Number</h1>
          <p className="text-sm text-slate-500 mt-1">
            Enter the OTP code sent to <strong className="text-slate-700">{masked}</strong>
          </p>
        </div>

        {/* Dev / Test Code Hint */}
        {regData?.devCode && (
          <div className="mb-5 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
            {regData.smsError ? (
              <p className="mb-1 text-amber-800 font-medium">Notice: {regData.smsError}</p>
            ) : null}
            <p>Verification Code: <strong className="font-mono text-sm text-slate-900 bg-amber-200/60 px-2 py-0.5 rounded">{regData.devCode}</strong></p>
          </div>
        )}

        {/* Success Banner */}
        {successInfo && (
          <div className="mb-5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5">
            <p className="text-emerald-700 text-sm font-medium">{successInfo}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-red-600 text-sm font-medium">{error}</p>
          </div>
        )}

        {/* 6-Digit OTP Input Boxes */}
        <div className="flex justify-center gap-2.5 sm:gap-3 mb-8" onPaste={handlePaste}>
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className={`w-11 h-14 sm:w-12 sm:h-[60px] text-center text-xl font-bold rounded-xl border-2 transition-all focus:outline-none
                ${error
                  ? 'bg-red-50 border-red-300 text-red-900 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                  : 'bg-white border-slate-200 text-slate-900 focus:border-[#025EA7] focus:ring-2 focus:ring-[#025EA7]/20'
                }`}
            />
          ))}
        </div>

        {/* Verify Button */}
        <button
          id="verify-otp-btn"
          type="button"
          onClick={() => handleVerify()}
          disabled={loading}
          className="w-full py-3.5 px-4 bg-[#025EA7] hover:bg-[#014883] active:scale-[0.99] text-white font-semibold rounded-xl shadow-lg shadow-blue-900/20 transition-all text-sm flex items-center justify-center disabled:opacity-60 mb-6"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Verify'
          )}
        </button>

        {/* Resend Timer */}
        <div className="text-center text-sm text-slate-500">
          {canResend ? (
            <button
              type="button"
              onClick={handleResend}
              className="text-[#025EA7] font-bold hover:underline"
            >
              Resend Code
            </button>
          ) : (
            <span>
              Resend code in <strong className="text-slate-700">{secondsRemaining}s</strong>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
