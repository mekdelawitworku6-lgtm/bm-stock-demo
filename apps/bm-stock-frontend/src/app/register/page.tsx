"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Lock, Eye, EyeOff, Building, Phone as PhoneIcon,
  Shield, AlertTriangle,
  Headset, Send,
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

/* ───────────────────── Contact Us Modal ───────────────────── */
function ContactUsModal({ onClose }: { onClose: () => void }) {
  const supportPhone = '+251 911 111 111';
  const telegramHandle = 'bmstock';
  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center border border-slate-100">
        <div className="w-14 h-14 bg-blue-50 text-[#025EA7] rounded-full flex items-center justify-center mx-auto mb-3">
          <Headset className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Contact Us</h3>
        <p className="text-xs text-slate-500 mt-1 mb-4">Need help? Reach our support team.</p>
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-center gap-2 mb-4">
          <PhoneIcon className="w-4 h-4 text-[#025EA7]" />
          <span className="font-semibold text-slate-900 text-sm">{supportPhone}</span>
        </div>
        <div className="flex gap-2 mb-3">
          <a href={`tel:${supportPhone.replace(/\s/g, '')}`} className="flex-1 py-2.5 border-2 border-[#025EA7] text-[#025EA7] rounded-xl text-xs font-semibold hover:bg-blue-50 flex items-center justify-center gap-1.5 transition-colors">
            <PhoneIcon className="w-4 h-4" /> Call Now
          </a>
          <a href={`https://t.me/${telegramHandle}`} target="_blank" rel="noopener noreferrer" className="flex-1 py-2.5 border-2 border-green-600 text-green-600 rounded-xl text-xs font-semibold hover:bg-green-50 flex items-center justify-center gap-1.5 transition-colors">
            <Send className="w-4 h-4" /> Telegram
          </a>
        </div>
        <button onClick={onClose} className="text-sm font-semibold text-slate-400 hover:text-slate-600 transition-colors">Done</button>
      </div>
    </div>
  );
}

/* ───────────────────── Register Page ───────────────────── */
export default function RegisterPage() {
  const router = useRouter();

  // Form fields — matching Flutter register_screen.dart
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [showContact, setShowContact] = useState(false);

  const getFullPhone = () => normalizePhone(phone);

  /* ─── Validation ────────────────────────── */
  const validate = (): string | null => {
    if (!companyName.trim()) return 'Business / Company Name is required';
    const fullPhone = getFullPhone();
    if (!isValidEthiopian(fullPhone)) return 'Please enter a valid Ethiopian phone number';
    if (!password || password.length < 6) return 'Password must be at least 6 characters';
    if (password !== confirmPassword) return 'Passwords do not match';
    if (!agreedToPrivacy) return 'Please review and accept the Privacy Policy to continue';
    return null;
  };

  /* ─── Submit ────────────────────────── */
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPhoneError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const fullPhone = getFullPhone();
    setLoading(true);

    try {
      // 1. Check if phone is already registered (before sending OTP)
      await api.checkRegistration(fullPhone);
    } catch (err: any) {
      setLoading(false);
      const msg = err?.message || 'Connection failed';
      setError(msg);
      return;
    }

    try {
      // 2. Send OTP for verification
      const otpResult = await api.sendOtp(fullPhone);
      setLoading(false);

      // 3. Build the verify args
      const verifyData = {
        companyName: companyName.trim(),
        phone: fullPhone,
        password,
        numCompanies: 1,
        verificationId: otpResult?.verificationId || '',
        ...(otpResult?.code ? { devCode: otpResult.code } : {}),
        ...(otpResult?.smsError ? { smsError: otpResult.smsError } : {}),
      };

      // Navigate to verify page with state
      const params = new URLSearchParams();
      params.set('data', btoa(JSON.stringify(verifyData)));
      router.push(`/verify?${params.toString()}`);

    } catch (err: any) {
      setLoading(false);
      const msg = err?.message || 'Failed to send verification code. Please check your phone number and try again.';
      setError(msg);
    }
  };

  /* ─── Input style helper ────────────────────────── */
  const inputClass = "w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#025EA7]/30 focus:border-[#025EA7] transition-all";

  return (
    <div className="stock-chart-bg min-h-screen w-full flex items-center justify-center p-4">
      <div className="w-full max-w-[520px] bg-white rounded-[24px] shadow-2xl p-8 md:p-10 relative z-10 animate-fade-in border border-white/20 my-8">

        {/* Brand Logo Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <img
            src="/logo/gelagle_logo_horizontal.png"
            alt="BM Stock Logo"
            className="h-12 object-contain mb-3"
            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
          />
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Business Registration</h1>
          <p className="text-sm text-slate-500 mt-1">Register your company and verify your identity</p>
        </div>

        {/* Error Banner */}
        {(error || phoneError) && (
          <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-red-600 text-sm font-medium">{error || phoneError}</p>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-3.5">

          {/* 1. Business / Company Name */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Business / Company Name *</label>
            <div className="relative">
              <Building className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Abyssinia Supermarket" required className={inputClass} />
            </div>
          </div>

          {/* 3. Phone Number */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Phone Number *</label>
            <div className="relative">
              <PhoneIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <span className="absolute left-9 top-2.5 text-xs text-slate-500 font-semibold">+251</span>
              <input type="tel" value={phone}
                onChange={(e) => {
                  let val = e.target.value.replace(/\D/g, '');
                  if (val.startsWith('251')) val = val.substring(3);
                  if (val.startsWith('0')) val = val.substring(1);
                  if (val.length > 9) val = val.substring(0, 9);
                  setPhone(val);
                  setPhoneError(null);
                }}
                placeholder="912345678" required
                className="w-full pl-20 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#025EA7]/30 focus:border-[#025EA7] transition-all" />
            </div>
          </div>

          {/* 9 & 10. Passwords Side-by-Side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Password *</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input type={showPassword ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password" required className={`${inputClass} pr-9`} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Confirm Password *</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input type={showConfirm ? 'text' : 'password'} value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password" required className={`${inputClass} pr-9`} />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Already have an account */}
          <div className="text-center text-xs text-slate-500 pt-1">
            Already have an account?{' '}
            <Link href="/login" className="text-[#025EA7] font-bold hover:underline">Log In</Link>
          </div>

          {/* Privacy Policy Checkbox */}
          <label className="flex items-start gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={agreedToPrivacy}
              onChange={(e) => setAgreedToPrivacy(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#025EA7] rounded shrink-0"
            />
            <span className="text-xs text-slate-500 leading-relaxed">
              I have read and agree to the{' '}
              <button type="button" className="text-[#025EA7] font-bold underline">Privacy Policy</button>
              , including how my account and payment details are collected, stored and retained.
            </span>
          </label>

          {/* Contact Us link */}
          <div className="text-center">
            <button type="button" onClick={() => setShowContact(true)}
              className="text-xs text-slate-500 hover:text-[#025EA7] transition-colors">
              Need help? <span className="font-bold text-[#025EA7] underline">Contact Us</span>
            </button>
          </div>

          {/* Submit Button */}
          <button
            id="register-submit-btn"
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-[#025EA7] hover:bg-[#014883] active:scale-[0.99] text-white font-semibold rounded-xl shadow-lg shadow-blue-900/20 transition-all text-sm flex items-center justify-center disabled:opacity-60"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Verify Phone Number'
            )}
          </button>
        </form>
      </div>

      {showContact && <ContactUsModal onClose={() => setShowContact(false)} />}
    </div>
  );
}
