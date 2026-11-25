"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  Phone as PhoneIcon, 
  AlertTriangle, 
  X, 
  Headset, 
  Send, 
  Hourglass, 
  Info,
  Building2,
  KeyRound,
  Shield,
  ArrowRight,
  User as UserIcon,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { canAccessWebApp } from '@/lib/subscriptionPlans';
import { useToast } from '@/components/Toast';

/* ───────────────────── Phone Utilities ───────────────────── */
function normalizePhone(raw: string): string {
  let clean = raw.trim().replace(/\D/g, '');
  if (clean.startsWith('251')) clean = clean.substring(3);
  if (clean.startsWith('0')) clean = clean.substring(1);
  return `+251${clean}`;
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
        <p className="text-xs text-slate-500 mt-1 mb-4">
          Need help? Reach our support team through any of the channels below.
        </p>

        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center justify-center gap-2 mb-4">
          <PhoneIcon className="w-4 h-4 text-[#025EA7]" />
          <span className="font-semibold text-slate-900 text-sm">{supportPhone}</span>
          <button
            onClick={() => { navigator.clipboard.writeText(supportPhone.replace(/\s/g, '')); }}
            className="text-slate-400 hover:text-slate-600 ml-1"
            title="Copy"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          </button>
        </div>

        <div className="flex gap-2 mb-3">
          <a
            href={`tel:${supportPhone.replace(/\s/g, '')}`}
            className="flex-1 py-2.5 border-2 border-[#025EA7] text-[#025EA7] rounded-xl text-xs font-semibold hover:bg-blue-50 flex items-center justify-center gap-1.5 transition-colors"
          >
            <PhoneIcon className="w-4 h-4" /> Call Now
          </a>
          <a
            href={`https://t.me/${telegramHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 py-2.5 border-2 border-green-600 text-green-600 rounded-xl text-xs font-semibold hover:bg-green-50 flex items-center justify-center gap-1.5 transition-colors"
          >
            <Send className="w-4 h-4" /> Telegram
          </a>
        </div>

        <button
          onClick={onClose}
          className="text-sm font-semibold text-slate-400 hover:text-slate-600 transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}

/* ───────────────────── Pending Approval Modal ───────────────────── */
function PendingApprovalModal({
  identifier,
  onClose,
}: {
  identifier: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [simulating, setSimulating] = useState(false);

  const handleSimulate = () => {
    setSimulating(true);
    setTimeout(() => {
      onClose();
      router.push('/dashboard');
    }, 1200);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center border border-slate-100 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
          <Hourglass className="w-6 h-6 animate-pulse" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">Awaiting Approval</h3>
        <p className="text-xs text-slate-500 mt-1 mb-3 leading-relaxed">
          The registration for <strong className="text-slate-800">{identifier || 'your account'}</strong> is currently pending platform admin approval.
        </p>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-[11px] text-left mb-4 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
          <span className="text-slate-600 font-medium leading-tight">
            Accounts are reviewed within 10–30 minutes during business hours.
          </span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleSimulate}
            disabled={simulating}
            className="flex-1 py-2 border border-blue-300 text-[#025EA7] hover:bg-blue-50 rounded-xl text-xs font-semibold transition-all flex items-center justify-center"
          >
            {simulating ? (
              <div className="w-4 h-4 border-2 border-[#025EA7] border-t-transparent rounded-full animate-spin" />
            ) : (
              'Simulate Approval'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── Login Page ───────────────────── */
export default function LoginPage() {
  const router = useRouter();
  const { staffFirstLogin, cadminFirstLogin, pinUnlock, resetDevice, saveDeviceConfig } = useAuth();

  // Mode: null while checking localStorage, then 'unlock' | 'setup' | 'pin-setup'
  const [authMode, setAuthMode] = useState<'unlock' | 'setup' | 'pin-setup' | null>(null);

  // Setup tab: 'admin' | 'staff'
  const [setupTab, setSetupTab] = useState<'admin' | 'staff'>('admin');

  // Device configuration saved data
  const [savedRole, setSavedRole] = useState<'admin' | 'staff'>('admin');
  const [savedAccountId, setSavedAccountId] = useState('');
  const [savedDisplayName, setSavedDisplayName] = useState('');
  const [savedCompanyName, setSavedCompanyName] = useState('');

  // Unlock state
  const [pin, setPin] = useState('');
  const pinInputRef = useRef<HTMLInputElement>(null);

  // New PIN setup state (for Company Admin setting up PIN after first login)
  const [newPin, setNewPin] = useState('');
  const [loggedInUser, setLoggedInUser] = useState<any>(null);
  const setupPinInputRef = useRef<HTMLInputElement>(null);

  // Admin form state (Phone Number + Password — no email or PIN yet!)
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  // Staff form state
  const [companyName, setCompanyName] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffPin, setStaffPin] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiryMessage, setExpiryMessage] = useState<string | null>(null);
  const [isTrialSuccess, setIsTrialSuccess] = useState(false);
  const [isReceiptVerified, setIsReceiptVerified] = useState(false);

  const { showToast } = useToast();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('trial') === 'true') {
        setIsTrialSuccess(true);
      }
      if (params.get('verified') === 'true') {
        setIsReceiptVerified(true);
        showToast('Payment receipt verified successfully! Your account is active. Please sign in.', 'success');
      }
      if (params.get('phone')) {
        setAdminPhone(params.get('phone')!.replace(/\D/g, '').replace(/^251/, ''));
      }
    }
  }, [showToast]);

  // Modals state
  const [showContact, setShowContact] = useState(false);
  const [showPendingApproval, setShowPendingApproval] = useState(false);

  // Read saved device config on mount
  useEffect(() => {
    const isConfigured = localStorage.getItem('auth_device_configured') === 'true';
    const role = (localStorage.getItem('auth_role') as 'admin' | 'staff') || 'admin';
    const accountId = localStorage.getItem('auth_account_id') || '';
    const displayName = localStorage.getItem('auth_display_name') || '';
    const compName = localStorage.getItem('auth_company_name') || '';

    if (isConfigured && accountId) {
      setSavedRole(role);
      setSavedAccountId(accountId);
      setSavedDisplayName(displayName);
      setSavedCompanyName(compName);
      setAuthMode('unlock');
    } else {
      setAuthMode('setup');
    }
  }, []);

  // Autofocus PIN inputs when entering unlock or setup mode
  useEffect(() => {
    if (authMode === 'unlock') {
      setTimeout(() => pinInputRef.current?.focus(), 150);
    } else if (authMode === 'pin-setup') {
      setTimeout(() => setupPinInputRef.current?.focus(), 150);
    }
  }, [authMode]);

  const handleSwitchAccount = () => {
    resetDevice();
    setPin('');
    setError(null);
    setExpiryMessage(null);
    setAuthMode('setup');
  };

  /* ── Quick PIN Unlock ── */
  const handlePinUnlock = async (enteredPin: string) => {
    if (enteredPin.length !== 4) return;
    setLoading(true);
    setError(null);
    setExpiryMessage(null);

    const errMsg = await pinUnlock({
      role: savedRole,
      accountId: savedAccountId,
      pin: enteredPin,
    });
    setLoading(false);

    if (!errMsg) {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('bm_user') : null;
      let loggedUser = stored ? JSON.parse(stored) : null;
      if (!canAccessWebApp(loggedUser)) {
        setError('Web App Access Restricted: The web app is exclusively accessible to users on the Large Business package (15,999 ETB). Please use the BM Stock Mobile App on Android/iOS, or upgrade your plan to Large Business to access the Web App.');
        return;
      }
      router.push('/dashboard');
    } else {
      setPin('');
      const lower = errMsg.toLowerCase();
      if (lower.includes('pending admin approval') || lower.includes('pending approval')) {
        setShowPendingApproval(true);
      } else if (lower.includes('subscription') && lower.includes('expired')) {
        setExpiryMessage(errMsg);
      } else {
        setError(errMsg);
      }
    }
  };

  /* ── C Admin First-Time Login ── */
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setExpiryMessage(null);

    const cleanDigits = adminPhone.trim().replace(/\D/g, '');
    if (!cleanDigits) {
      setError('Please enter your phone number');
      return;
    }
    if (!adminPassword) {
      setError('Please enter your password');
      return;
    }

    const fullPhone = normalizePhone(adminPhone);
    if (typeof window !== 'undefined') {
      localStorage.setItem('auth_phone', fullPhone);
      localStorage.setItem('last_login_phone', fullPhone);
    }

    setLoading(true);
    const { error: errMsg, hasPin, user: authUser } = await cadminFirstLogin({
      email: fullPhone,
      password: adminPassword,
    });
    setLoading(false);

    if (!errMsg) {
      if (!canAccessWebApp(authUser)) {
        setError('Web App Access Restricted: The web app is exclusively accessible to users on the Large Business package (15,999 ETB). Please use the BM Stock Mobile App on Android/iOS, or upgrade your plan to Large Business to access the Web App.');
        return;
      }
      if (hasPin) {
        router.push('/dashboard');
      } else {
        // Admin doesn't have a 4-digit PIN yet. Seamlessly prompt to set one for quick unlocks.
        setLoggedInUser(authUser);
        setNewPin('');
        setAuthMode('pin-setup');
      }
    } else {
      const lower = errMsg.toLowerCase();
      if (lower.includes('pending admin approval') || lower.includes('pending approval')) {
        setShowPendingApproval(true);
      } else if (lower.includes('subscription') && lower.includes('expired')) {
        setExpiryMessage(errMsg);
      } else {
        setError(errMsg);
      }
    }
  };

  /* ── Save Newly Created PIN (Post-Login) ── */
  const handleSaveNewPin = async (enteredPin: string) => {
    if (enteredPin.length !== 4) {
      setError('PIN must be exactly 4 digits');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.setAdminPin(enteredPin);
      if (loggedInUser) {
        saveDeviceConfig(loggedInUser, 'admin', loggedInUser.id);
      }
      if (!canAccessWebApp(loggedInUser)) {
        setError('Web App Access Restricted: The web app is exclusively accessible to users on the Large Business package (15,999 ETB). Please use the BM Stock Mobile App on Android/iOS, or upgrade your plan to Large Business to access the Web App.');
        return;
      }
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Failed to save security PIN');
    } finally {
      setLoading(false);
    }
  };

  const handleSkipPinSetup = () => {
    if (!canAccessWebApp(loggedInUser)) {
      setError('Web App Access Restricted: The web app is exclusively accessible to users on the Large Business package (15,999 ETB). Please use the BM Stock Mobile App on Android/iOS, or upgrade your plan to Large Business to access the Web App.');
      return;
    }
    router.push('/dashboard');
  };

  /* ── Staff First-Time Login ── */
  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setExpiryMessage(null);

    if (!companyName.trim()) {
      setError('Please enter your company name');
      return;
    }
    if (!staffPhone.trim()) {
      setError('Please enter your staff phone number');
      return;
    }
    if (!staffPin || staffPin.length !== 4) {
      setError('Please enter your assigned 4-digit PIN');
      return;
    }

    if (typeof window !== 'undefined' && staffPhone.trim()) {
      localStorage.setItem('auth_phone', staffPhone.trim());
      localStorage.setItem('last_login_phone', staffPhone.trim());
    }

    setLoading(true);
    const errMsg = await staffFirstLogin({
      companyName: companyName.trim(),
      phone: staffPhone.trim(),
      pin: staffPin,
    });
    setLoading(false);

    if (!errMsg) {
      const stored = typeof window !== 'undefined' ? localStorage.getItem('bm_user') : null;
      let loggedUser = stored ? JSON.parse(stored) : null;
      if (!canAccessWebApp(loggedUser)) {
        setError('Web App Access Restricted: The web app is exclusively accessible to users on the Large Business package (15,999 ETB). Please use the BM Stock Mobile App on Android/iOS, or upgrade your plan to Large Business to access the Web App.');
        return;
      }
      router.push('/dashboard');
    } else {
      const lower = errMsg.toLowerCase();
      if (lower.includes('pending admin approval') || lower.includes('pending approval')) {
        setShowPendingApproval(true);
      } else if (lower.includes('subscription') && lower.includes('expired')) {
        setExpiryMessage(errMsg);
      } else {
        setError(errMsg);
      }
    }
  };

  if (authMode === null) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-3 border-[#025EA7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="stock-chart-bg min-h-screen w-full flex items-center justify-center p-4">
      <div className="w-full max-w-[460px] bg-white rounded-[24px] shadow-2xl p-8 md:p-10 relative z-10 animate-fade-in border border-white/20">

        {/* Brand Logo Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <img
            src="/logo/gelagle_logo_horizontal.png"
            alt="BM Stock Logo"
            className="h-12 object-contain mb-3"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {authMode === 'unlock'
              ? 'Quick Unlock'
              : authMode === 'pin-setup'
              ? 'Create Security PIN'
              : 'Welcome to BM Stock'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {authMode === 'unlock'
              ? 'Enter your 4-digit security PIN to access your account'
              : authMode === 'pin-setup'
              ? 'Set a 4-digit PIN for quick future unlocks on this device'
              : 'Sign in to manage your inventory and sales'}
          </p>
        </div>

        {/* Trial Success Banner */}
        {isTrialSuccess && !error && (
          <div className="mb-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 shadow-xs animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wide">14-Day Free Trial Activated!</h4>
              <p className="text-emerald-700 text-xs font-medium mt-0.5 leading-snug">
                Your account has been created and your 14-day free trial is now active. Please <strong>sign in below with your phone number and password</strong> to start exploring BM Stock.
              </p>
            </div>
          </div>
        )}

        {/* Receipt Verified Success Banner */}
        {isReceiptVerified && !error && !isTrialSuccess && (
          <div className="mb-5 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 shadow-xs animate-fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wide">Payment Verified Successfully!</h4>
              <p className="text-emerald-700 text-xs font-medium mt-0.5 leading-snug">
                Your payment receipt has been verified and your account is now active. Please <strong>sign in below with your phone number and password</strong> to get started.
              </p>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 shadow-xs">
            <div className="w-8 h-8 rounded-xl bg-red-100 flex items-center justify-center shrink-0 text-red-600 mt-0.5">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-bold text-red-800 uppercase tracking-wide">Sign In Notice</h4>
              <p className="text-red-700 text-sm font-medium mt-0.5 leading-snug">{error}</p>
              {error.includes('Large Business') && (
                <div className="mt-3">
                  <Link
                    href="/choose-plan"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#025EA7] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#014883] transition-all"
                  >
                    Upgrade to Large Plan (15,999 ETB) <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Subscription Expired Banner */}
        {expiryMessage && (
          <div className="mb-5 p-4 rounded-2xl bg-amber-50 border border-amber-300 flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-amber-900 text-sm font-semibold">{expiryMessage}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const phoneToUse =
                      (adminPhone ? normalizePhone(adminPhone) : '') ||
                      staffPhone.trim() ||
                      (() => {
                        if (typeof window === 'undefined') return '';
                        const direct = localStorage.getItem('auth_phone') || localStorage.getItem('last_login_phone');
                        if (direct) return direct;
                        try {
                          const raw = localStorage.getItem('bm_user');
                          if (raw) {
                            const u = JSON.parse(raw);
                            return u?.phone || u?.employee?.phone || '';
                          }
                        } catch (_) {}
                        return '';
                      })();
                    router.push(`/choose-plan?renewal=true${phoneToUse ? `&phone=${encodeURIComponent(phoneToUse)}` : ''}`);
                  }}
                  className="px-4 py-2.5 bg-[#025EA7] hover:bg-[#024A85] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Renew Subscription</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setShowContact(true)}
                  className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Contact Support
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════
            MODE 1: QUICK PIN UNLOCK (DEVICE CONFIGURED)
           ══════════════════════════════════════════════════ */}
        {authMode === 'unlock' ? (
          <div className="space-y-6">
            {/* User card */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-center">
              <div className="w-12 h-12 bg-blue-100 text-[#025EA7] rounded-full flex items-center justify-center mx-auto mb-2 font-bold text-lg">
                {savedDisplayName ? savedDisplayName[0]?.toUpperCase() : <UserIcon className="w-6 h-6" />}
              </div>
              <div className="font-bold text-slate-900 text-base">{savedDisplayName || 'User'}</div>
              {savedCompanyName ? (
                <div className="text-xs font-medium text-[#025EA7] mt-0.5 inline-flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> {savedCompanyName}
                </div>
              ) : (
                <div className="text-xs text-slate-400 capitalize">{savedRole} Account</div>
              )}
            </div>

            {/* PIN Input Boxes with direct keyboard typing (No on-screen number pad) */}
            <div className="space-y-4">
              <div 
                onClick={() => pinInputRef.current?.focus()}
                className="flex justify-center gap-3 py-2 cursor-pointer select-none"
              >
                {[0, 1, 2, 3].map((index) => {
                  const filled = pin.length > index;
                  const isCurrent = pin.length === index;
                  return (
                    <div
                      key={index}
                      className={`w-14 h-16 rounded-2xl border-2 flex items-center justify-center text-2xl font-black transition-all shadow-sm ${
                        filled
                          ? 'border-[#025EA7] bg-blue-50/80 text-[#025EA7]'
                          : isCurrent
                          ? 'border-[#025EA7] bg-white ring-4 ring-blue-500/15'
                          : 'border-slate-200 bg-slate-50 text-slate-300'
                      }`}
                    >
                      {filled ? '●' : ''}
                    </div>
                  );
                })}
              </div>

              {/* Hidden input to capture physical keyboard typing */}
              <input
                ref={pinInputRef}
                id="pin-unlock-input"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoFocus
                value={pin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setPin(val);
                  if (val.length === 4) {
                    handlePinUnlock(val);
                  }
                }}
                className="opacity-0 absolute -z-10 w-0 h-0 pointer-events-none"
              />

              <p className="text-center text-xs text-slate-500 font-medium">
                Type your 4-digit PIN on your keyboard
              </p>

              {pin.length > 0 && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setPin('');
                      pinInputRef.current?.focus();
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {loading && (
              <div className="flex justify-center items-center gap-2 text-xs text-slate-500 font-medium">
                <div className="w-4 h-4 border-2 border-[#025EA7] border-t-transparent rounded-full animate-spin" />
                Unlocking session...
              </div>
            )}

            {/* Switch Account */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={handleSwitchAccount}
                className="text-xs font-semibold text-[#025EA7] hover:underline inline-flex items-center gap-1.5 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Switch to a Different Account
              </button>
            </div>
          </div>
        ) : authMode === 'pin-setup' ? (
          /* ══════════════════════════════════════════════════
              MODE 3: SET UP 4-DIGIT PIN (POST-LOGIN)
             ══════════════════════════════════════════════════ */
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-50 text-[#025EA7] rounded-full flex items-center justify-center mx-auto mb-2">
                <KeyRound className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Create Security PIN</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Set a 4-digit PIN so you can quickly unlock BM Stock on this device in the future using your keyboard.
              </p>
            </div>

            {/* PIN Boxes for Setup */}
            <div className="space-y-4">
              <div 
                onClick={() => setupPinInputRef.current?.focus()}
                className="flex justify-center gap-3 py-2 cursor-pointer select-none"
              >
                {[0, 1, 2, 3].map((index) => {
                  const filled = newPin.length > index;
                  const isCurrent = newPin.length === index;
                  return (
                    <div
                      key={index}
                      className={`w-14 h-16 rounded-2xl border-2 flex items-center justify-center text-2xl font-black transition-all shadow-sm ${
                        filled
                          ? 'border-[#025EA7] bg-blue-50/80 text-[#025EA7]'
                          : isCurrent
                          ? 'border-[#025EA7] bg-white ring-4 ring-blue-500/15'
                          : 'border-slate-200 bg-slate-50 text-slate-300'
                      }`}
                    >
                      {filled ? '●' : ''}
                    </div>
                  );
                })}
              </div>

              <input
                ref={setupPinInputRef}
                id="pin-setup-input"
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                autoFocus
                value={newPin}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setNewPin(val);
                  if (val.length === 4) {
                    handleSaveNewPin(val);
                  }
                }}
                className="opacity-0 absolute -z-10 w-0 h-0 pointer-events-none"
              />

              <p className="text-center text-xs text-slate-500 font-medium">
                Type 4 digits on your keyboard to set your PIN
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                disabled={loading || newPin.length !== 4}
                onClick={() => handleSaveNewPin(newPin)}
                className="w-full py-3 bg-[#025EA7] hover:bg-[#014883] text-white font-semibold rounded-xl shadow-md shadow-blue-900/20 text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Save PIN & Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleSkipPinSetup}
                className="w-full py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Skip for now
              </button>
            </div>
          </div>
        ) : (
          /* ══════════════════════════════════════════════════
              MODE 2: FIRST-TIME SETUP (ADMIN / STAFF TABS)
             ══════════════════════════════════════════════════ */
          <div>
            {/* Segmented Tab Selector */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl mb-6 text-sm font-semibold">
              <button
                type="button"
                onClick={() => {
                  setSetupTab('admin');
                  setError(null);
                }}
                className={`py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 ${
                  setupTab === 'admin'
                    ? 'bg-white text-[#025EA7] shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                👑 Company Admin
              </button>
              <button
                type="button"
                onClick={() => {
                  setSetupTab('staff');
                  setError(null);
                }}
                className={`py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 ${
                  setupTab === 'staff'
                    ? 'bg-white text-[#025EA7] shadow-sm font-bold'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                👤 Staff Sign In
              </button>
            </div>

            {/* ───── COMPANY ADMIN SECTION ───── */}
            {setupTab === 'admin' ? (
              <form onSubmit={handleAdminLogin} className="space-y-4">
                {isReceiptVerified && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-semibold flex items-center gap-2.5 shadow-xs animate-fade-in">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold">Payment Receipt Verified!</p>
                      <p className="text-[11px] text-emerald-700 font-normal mt-0.5">Your account has been activated successfully. Please sign in to continue.</p>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <PhoneIcon className="w-4 h-4" />
                    </div>
                    <div className="absolute inset-y-0 left-9 flex items-center pointer-events-none text-slate-500 font-medium text-sm">
                      +251
                    </div>
                    <input
                      id="cadmin-phone"
                      type="tel"
                      value={adminPhone}
                      onChange={(e) => {
                        setAdminPhone(e.target.value.replace(/\D/g, ''));
                        setError(null);
                      }}
                      placeholder="912345678"
                      required
                      className={`w-full pl-20 pr-4 py-2.5 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 text-sm font-medium transition-all ${
                        error
                          ? 'bg-red-50/20 border border-red-300 focus:ring-red-500/20 focus:border-red-500'
                          : 'bg-slate-50 border border-slate-200 focus:ring-[#025EA7]/30 focus:border-[#025EA7]'
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="cadmin-password"
                      type={showAdminPassword ? 'text' : 'password'}
                      value={adminPassword}
                      onChange={(e) => {
                        setAdminPassword(e.target.value);
                        setError(null);
                      }}
                      placeholder="••••••••"
                      required
                      className={`w-full pl-10 pr-10 py-2.5 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 text-sm font-medium transition-all ${
                        error
                          ? 'bg-red-50/20 border border-red-300 focus:ring-red-500/20 focus:border-red-500'
                          : 'bg-slate-50 border border-slate-200 focus:ring-[#025EA7]/30 focus:border-[#025EA7]'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowAdminPassword(!showAdminPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600"
                    >
                      {showAdminPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  id="cadmin-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 px-4 bg-[#025EA7] hover:bg-[#014883] active:scale-[0.99] text-white font-semibold rounded-xl shadow-md shadow-blue-900/20 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Sign In as Admin</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <Link href="/forgot-password" className="text-[#025EA7] font-medium hover:underline">
                    Forgot Password?
                  </Link>
                  <div className="text-slate-500">
                    New business?{' '}
                    <Link href="/register" className="text-[#025EA7] font-bold hover:underline">
                      Sign Up
                    </Link>
                  </div>
                </div>
              </form>
            ) : (
              /* ───── STAFF SIGN-IN FORM ───── */
              <form onSubmit={handleStaffLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Company Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <input
                      id="staff-company-name"
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="e.g. Gelagle Trading"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#025EA7]/30 focus:border-[#025EA7] text-sm font-medium"
                    />
                  </div>
                </div>


                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Your Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <PhoneIcon className="w-4 h-4" />
                    </div>
                    <div className="absolute inset-y-0 left-9 flex items-center pointer-events-none text-slate-500 font-medium text-sm">
                      +251
                    </div>
                    <input
                      id="staff-phone"
                      type="tel"
                      value={staffPhone}
                      onChange={(e) => {
                        setStaffPhone(e.target.value.replace(/\D/g, ''));
                        setError(null);
                      }}
                      placeholder="912345678"
                      required
                      className="w-full pl-20 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#025EA7]/30 focus:border-[#025EA7] text-sm font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Your Assigned 4-Digit PIN
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      id="staff-pin"
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      value={staffPin}
                      onChange={(e) => setStaffPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      required
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#025EA7]/30 focus:border-[#025EA7] text-sm font-medium"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Ask your company admin for your company credentials and personal PIN.
                  </p>
                </div>

                <button
                  id="staff-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 px-4 bg-[#025EA7] hover:bg-[#014883] active:scale-[0.99] text-white font-semibold rounded-xl shadow-md shadow-blue-900/20 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Sign In as Staff</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            <div className="text-center pt-4">
              <button
                type="button"
                onClick={() => setShowContact(true)}
                className="text-xs text-slate-500 hover:text-[#025EA7] transition-colors"
              >
                Need help? <span className="font-bold text-[#025EA7] underline">Contact Support</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showContact && <ContactUsModal onClose={() => setShowContact(false)} />}
      {showPendingApproval && (
        <PendingApprovalModal
          identifier={adminPhone || companyName || 'your account'}
          onClose={() => setShowPendingApproval(false)}
        />
      )}
    </div>
  );
}
