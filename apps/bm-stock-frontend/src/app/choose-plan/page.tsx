"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft, CheckCircle2, Shield, Phone as PhoneIcon,
  Building2, Upload, Copy, Check, AlertTriangle, X, CreditCard, Sparkles,
  Clock, Star, Zap, Info, Link as LinkIcon, ShieldCheck
} from 'lucide-react';
import { api } from '@/lib/api';
import { decodeQrFromImageFile } from '@/lib/qrScanner';
import { useToast } from '@/components/Toast';

/* ───────────────────── Payment Config ───────────────────── */
const MANUAL_PAYMENT_CONFIG = {
  telebirr: {
    name: 'Possible Tech PLC',
    phone: '0911578793',
  },
  cbe: {
    name: 'Possible Tech PLC',
    account: '1000301736537',
  },
};

const DEFAULT_PLANS = [
  {
    id: 'trial',
    title: 'Free Trial',
    price: 0,
    period: 'trial',
    badge: '14 Days Free',
    features: [
      '14-Day Free Trial',
      'All features included for evaluation',
      'Up to 1 store',
      'Up to 1 warehouse',
      'Up to 1 staff account',
      'Single product entry',
      'Mobile app access only (No web app)',
      'No credit card required',
    ],
  },
  {
    id: 'small',
    title: 'Small Business',
    price: 7999,
    period: 'small',
    features: [
      'Up to 1 store',
      'Up to 1 warehouse',
      'Up to 1 staff account',
      'Single product entry only (No bulk/import)',
      'Mobile app access only (No web app)',
      'Basic analytics & reports',
    ],
  },
  {
    id: 'medium',
    title: 'Medium Business',
    price: 10999,
    period: 'medium',
    badge: 'Popular',
    features: [
      'Up to 5 stores',
      'Up to 5 shops',
      'Up to 5 staff accounts',
      'Bulk entry for products',
      'Mobile app access only (No web app)',
      'Advanced analytics & reports',
    ],
  },
  {
    id: 'large',
    title: 'Large Business',
    price: 15999,
    period: 'large',
    badge: 'Best Value',
    features: [
      'Unlimited stores & shops',
      'Unlimited staff accounts',
      'Bulk entry for products',
      'CSV & PDF import for products',
      'Commission management',
      'Product borrowing',
      'Full Web App & Mobile Access',
      'Advanced analytics & custom reports',
      '24/7 priority support',
    ],
  },
  {
    id: 'verification_test',
    title: 'Verification Test',
    price: 1,
    period: 'verification_test',
    badge: '1 Birr Test',
    features: [
      'Instant receipt-verified activation',
      'No admin approval required',
      'Up to 1 store',
      'Up to 1 shop',
      'Up to 1 staff account',
    ],
  },
];

function formatPrice(val: number): string {
  return val.toLocaleString();
}

function isLargeBusinessPlan(plan?: { id?: string; period?: string; title?: string } | null): boolean {
  if (!plan) return false;
  const raw = `${plan.id || ''} ${plan.period || ''} ${plan.title || ''}`.toLowerCase();
  if (
    raw.includes('trial') ||
    raw.includes('small') ||
    raw.includes('starter') ||
    raw.includes('7999') ||
    raw.includes('medium') ||
    raw.includes('growth') ||
    raw.includes('10999') ||
    raw.includes('verification')
  ) {
    return false;
  }
  return (
    raw.includes('large') ||
    raw.includes('enterprise') ||
    raw.includes('15999') ||
    raw.includes('15,999')
  );
}

/* ───────────────────── Trial Confirmation Modal ───────────────────── */
interface TrialConfirmationModalProps {
  plan: typeof DEFAULT_PLANS[0];
  onClose: () => void;
  onConfirm: () => void;
  submitting: boolean;
}

function TrialConfirmationModal({ plan, onClose, onConfirm, submitting }: TrialConfirmationModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl p-6 sm:p-8 w-full max-w-md shadow-2xl relative my-8 border border-slate-100">

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 transition-colors p-1"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-200/50">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-extrabold text-slate-900 text-center mb-1">Start Your Free Trial</h2>
        <p className="text-xs text-slate-500 text-center mb-5">
          Enjoy <strong className="text-slate-800">14 days of full access</strong> — no credit card required.
        </p>

        {/* Trial Details Card */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">What's Included</span>
          </div>
          <div className="space-y-2.5">
            {plan.features.map((feat, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-xs text-emerald-900 font-medium">{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Payment Notice */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-xs font-bold text-amber-800 mb-1">After Your Trial Ends</h4>
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Your 14-day free trial will expire automatically. To continue using BM Stock, you'll need to
              choose and pay for a subscription plan. <strong>No automatic charges</strong> — you decide when to upgrade.
            </p>
          </div>
        </div>

        {/* Trial Period Summary */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-5 flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Trial Period</div>
            <div className="text-sm font-extrabold text-slate-900 mt-0.5">14 Days — Free</div>
          </div>
          <div className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
            No Payment Required
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 active:scale-[0.99] text-white font-bold rounded-xl shadow-lg shadow-emerald-200/50 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>Confirm & Start Free Trial</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="w-full py-2.5 text-xs font-semibold text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────── Payment Modal ───────────────────── */
interface PaymentModalProps {
  plan: typeof DEFAULT_PLANS[0];
  numCompanies: number;
  onClose: () => void;
  onSubmitPayment: (details: {
    paymentMethod: string;
    paymentRef: string;
    paymentScreenshot?: string;
    receiptUrl?: string;
  }) => Promise<void>;
}

function PaymentModal({ plan, numCompanies, onClose, onSubmitPayment }: PaymentModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<'Telebirr' | 'CBE'>('Telebirr');
  const [paymentRef, setPaymentRef] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrScanned, setQrScanned] = useState(false);

  const totalAmount = plan.price * numCompanies;

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setError(null);
      setQrScanned(false);
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = document.createElement('img');
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 800;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          setScreenshotPreview(canvas.toDataURL('image/jpeg', 0.75));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);

      try {
        const decoded = await decodeQrFromImageFile(file);
        if (decoded) {
          setReceiptUrl(decoded);
          setQrScanned(true);
        }
      } catch (_) {}
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const refNo = paymentRef.trim() || `GS${Date.now()}`;
    setSubmitting(true);

    try {
      await onSubmitPayment({
        paymentMethod: selectedMethod,
        paymentRef: refNo,
        paymentScreenshot: screenshotPreview || undefined,
        receiptUrl: receiptUrl.trim() || undefined,
      });
    } catch (err: any) {
      setError(err?.message || 'Payment submission failed. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-2xl p-6 sm:p-8 w-full max-w-lg shadow-2xl relative my-8 border border-slate-100">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 transition-colors p-1"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <h2 className="text-xl font-bold text-slate-900 mb-1">Make Your Payment</h2>
        <p className="text-xs text-slate-500 mb-5">
          Pay for <strong className="text-slate-800">{plan.title}</strong> via Telebirr or CBE, then upload your receipt screenshot.
        </p>

        {/* Summary Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-slate-500">{plan.title}</div>
            <div className="text-xs text-slate-400 mt-0.5">
              {numCompanies > 1
                ? `ETB ${formatPrice(plan.price)} × ${numCompanies} companies`
                : '1 Company Slot'}
            </div>
          </div>
          <div className="text-lg font-extrabold text-[#025EA7]">
            ETB {formatPrice(totalAmount)}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-600 font-medium">
            <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Select Payment Method</label>
            <div className="grid grid-cols-2 gap-3">

              {/* Telebirr Option */}
              <button
                type="button"
                onClick={() => setSelectedMethod('Telebirr')}
                className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                  selectedMethod === 'Telebirr'
                    ? 'border-[#025EA7] bg-blue-50/60 ring-2 ring-[#025EA7]/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#025EA7] flex items-center justify-center font-bold text-xs">
                    📱
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    selectedMethod === 'Telebirr' ? 'border-[#025EA7] bg-[#025EA7]' : 'border-slate-300'
                  }`}>
                    {selectedMethod === 'Telebirr' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                </div>
                <div className="font-bold text-slate-900 text-xs">Telebirr</div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-mono">{MANUAL_PAYMENT_CONFIG.telebirr.phone}</div>
              </button>

              {/* CBE Option */}
              <button
                type="button"
                onClick={() => setSelectedMethod('CBE')}
                className={`p-3 rounded-xl border-2 text-left transition-all flex flex-col justify-between ${
                  selectedMethod === 'CBE'
                    ? 'border-[#025EA7] bg-blue-50/60 ring-2 ring-[#025EA7]/20'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                    🏦
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    selectedMethod === 'CBE' ? 'border-[#025EA7] bg-[#025EA7]' : 'border-slate-300'
                  }`}>
                    {selectedMethod === 'CBE' && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                  </div>
                </div>
                <div className="font-bold text-slate-900 text-xs">CBE Bank</div>
                <div className="text-[11px] text-slate-500 mt-0.5 font-mono">{MANUAL_PAYMENT_CONFIG.cbe.account}</div>
              </button>

            </div>
          </div>

          {/* Account Details Box */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span>Account Name:</span>
              <strong className="text-slate-900 font-semibold">
                {selectedMethod === 'Telebirr' ? MANUAL_PAYMENT_CONFIG.telebirr.name : MANUAL_PAYMENT_CONFIG.cbe.name}
              </strong>
            </div>

            <div className="flex justify-between items-center text-slate-600 pt-1 border-t border-slate-200">
              <span>{selectedMethod === 'Telebirr' ? 'Telebirr Number:' : 'Account Number:'}</span>
              <div className="flex items-center gap-1.5">
                <strong className="text-[#025EA7] font-mono font-bold">
                  {selectedMethod === 'Telebirr' ? MANUAL_PAYMENT_CONFIG.telebirr.phone : MANUAL_PAYMENT_CONFIG.cbe.account}
                </strong>
                <button
                  type="button"
                  onClick={() => copyToClipboard(
                    selectedMethod === 'Telebirr' ? MANUAL_PAYMENT_CONFIG.telebirr.phone : MANUAL_PAYMENT_CONFIG.cbe.account,
                    'acc'
                  )}
                  className="text-slate-400 hover:text-[#025EA7] p-1 transition-colors"
                  title="Copy"
                >
                  {copiedField === 'acc' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Receipt URL / Link for auto-verification */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Receipt URL / Reference Link <span className="text-slate-400 font-normal">(for auto-verification)</span>
              </label>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const text = await navigator.clipboard.readText();
                    if (text?.trim()) setReceiptUrl(text.trim());
                  } catch (_) {}
                }}
                className="text-[11px] text-[#025EA7] hover:underline font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" /> Paste
              </button>
            </div>
            <div className="relative">
              <LinkIcon className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={receiptUrl}
                onChange={(e) => setReceiptUrl(e.target.value)}
                placeholder={selectedMethod === 'CBE' ? 'https://mbreciept.cbe.com.et/... or transaction reference' : 'Paste Telebirr/CBE receipt link or reference number'}
                className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-[#025EA7]/30 focus:border-[#025EA7] focus:outline-none"
              />
              {receiptUrl && (
                <button
                  type="button"
                  onClick={() => { setReceiptUrl(''); setQrScanned(false); }}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
              Paste the receipt URL from Telebirr/CBE to auto-verify your payment & activate instantly
            </p>
          </div>

          {/* Transaction Reference Number (optional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Transaction Reference / Ref Number <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder="e.g. GS171234567890"
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-medium focus:ring-2 focus:ring-[#025EA7]/30 focus:border-[#025EA7] focus:outline-none"
            />
          </div>

          {/* Upload Payment Screenshot */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Upload Payment Screenshot / Receipt
            </label>
            <label className="border-2 border-dashed border-slate-200 hover:border-[#025EA7] rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-50/50 hover:bg-blue-50/20 text-center">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {screenshotPreview ? (
                <div className="relative w-full max-h-32 flex flex-col items-center justify-center">
                  <img src={screenshotPreview} alt="Receipt Preview" className="max-h-28 object-contain rounded-lg shadow-sm" />
                  <span className="text-[10px] text-[#025EA7] font-semibold mt-1">Click to replace screenshot</span>
                </div>
              ) : (
                <>
                  <Upload className="w-6 h-6 text-slate-400 mb-1.5" />
                  <span className="text-xs font-semibold text-[#025EA7]">Click to browse & upload screenshot</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">PNG, JPG or JPEG (receipt screenshot with QR code)</span>
                </>
              )}
            </label>
            {qrScanned && (
              <div className="mt-2 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[11px] font-semibold flex items-center gap-1.5 animate-fade-in">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>QR Code detected & receipt URL automatically extracted!</span>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 px-4 bg-[#025EA7] hover:bg-[#014883] active:scale-[0.99] text-white font-semibold rounded-xl shadow-lg shadow-blue-900/20 transition-all text-sm flex items-center justify-center disabled:opacity-60 mt-2"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              'Submit for Verification'
            )}
          </button>
        </form>

      </div>
    </div>
  );
}

/* ───────────────────── Main Choose Plan Screen ───────────────────── */
export default function ChoosePlanPage() {
  return (
    <Suspense fallback={
      <div className="stock-chart-bg min-h-screen w-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ChoosePlanInner />
    </Suspense>
  );
}

function ChoosePlanInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  // Decode registration data from URL
  const [regData, setRegData] = useState<Record<string, any> | null>(null);
  const [plans, setPlans] = useState<typeof DEFAULT_PLANS>(DEFAULT_PLANS);
  const [selectedPlan, setSelectedPlan] = useState<typeof DEFAULT_PLANS[0]>(DEFAULT_PLANS[0]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showTrialModal, setShowTrialModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRenewal = searchParams.get('renewal') === 'true';
  const renewalPhone = searchParams.get('phone') || '';

  useEffect(() => {
    if (isRenewal) {
      const activePhone =
        renewalPhone ||
        (typeof window !== 'undefined'
          ? localStorage.getItem('auth_phone') || localStorage.getItem('last_login_phone')
          : '') ||
        '';

      setRegData({
        phone: activePhone,
        companyName: 'Subscription Renewal',
        numCompanies: 1,
      });

      if (activePhone) {
        api.renewalPreview(activePhone).then((preview) => {
          if (preview?.numCompanies) {
            setRegData((prev) => ({
              ...prev,
              phone: activePhone,
              numCompanies: preview.numCompanies,
            }));
          }
        }).catch(() => {});
      }
      return;
    }
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
  }, [searchParams, router, isRenewal, renewalPhone]);

  useEffect(() => {
    async function fetchLivePlans() {
      try {
        const live = await api.getPlans();
        if (Array.isArray(live) && live.length > 0) {
          const formatted = live
            .map((p: any) => {
              const rawPrice = p.price ?? p.amount ?? 0;
              const numericPrice = typeof rawPrice === 'number'
                ? rawPrice
                : parseFloat(rawPrice.toString().replace(/,/g, '')) || 0;

              return {
                id: p.id || p.period || '',
                title: p.title || 'Subscription Plan',
                price: numericPrice,
                period: p.period || p.id || '',
                badge: p.badge || (p.period === '6_months' ? 'Popular' : p.period === '1_year' ? 'Best Value' : undefined),
                features: Array.isArray(p.features) && p.features.length > 0
                  ? p.features
                  : DEFAULT_PLANS[0].features,
              };
            });

          if (formatted.length > 0) {
            setPlans(formatted);
            setSelectedPlan((prev) => {
              const match = formatted.find((fp) => fp.id === prev.id || fp.period === prev.period);
              return match || formatted[0];
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch live plans, using defaults:', err);
      }
    }
    fetchLivePlans();
  }, []);

  const [largePlanCompanies, setLargePlanCompanies] = useState<number>(() => {
    const raw = regData?.numCompanies ? parseInt(regData.numCompanies) : 1;
    return isNaN(raw) || raw < 1 ? 1 : raw;
  });

  useEffect(() => {
    if (regData?.numCompanies) {
      const parsed = parseInt(regData.numCompanies);
      if (!isNaN(parsed) && parsed > 1) {
        setLargePlanCompanies(parsed);
      }
    }
  }, [regData?.numCompanies]);

  const isSelectedLarge = isLargeBusinessPlan(selectedPlan);
  const effectiveNumCompanies = isSelectedLarge ? Math.max(1, largePlanCompanies) : 1;

  /* ─── Receipt Auto-Verification Helper ────────────────────── */
  const tryVerifyReceipt = async (paymentDetails: {
    paymentMethod: string;
    paymentRef: string;
    paymentScreenshot?: string;
    receiptUrl?: string;
  }): Promise<{ verified: boolean; alreadyUsed?: boolean; message?: string }> => {
    // If a receipt URL or screenshot is provided, attempt auto-verification
    const hasReceiptUrl = paymentDetails.receiptUrl && paymentDetails.receiptUrl.trim().length > 0;
    const hasScreenshot = paymentDetails.paymentScreenshot && paymentDetails.paymentScreenshot.startsWith('data:');

    if (!hasReceiptUrl && !hasScreenshot) return { verified: false };

    try {
      const bankId = paymentDetails.paymentMethod.toLowerCase().includes('telebirr')
        ? 'telebirr'
        : paymentDetails.paymentMethod.toLowerCase().includes('cbe')
        ? 'cbe'
        : paymentDetails.paymentMethod.toLowerCase().trim();
      const verifyPayload: Record<string, any> = { bank: bankId };

      if (hasReceiptUrl) {
        const url = paymentDetails.receiptUrl!.trim();
        verifyPayload.receiptUrl = url;
        // If it looks like a URL, also set as link
        if (/^https?:\/\//i.test(url)) {
          verifyPayload.link = url;
        } else {
          verifyPayload.reference = url;
        }
      }

      if (hasScreenshot) {
        verifyPayload.imageBase64 = paymentDetails.paymentScreenshot;
      }

      const result = await api.verifyReceipt(verifyPayload);
      if (result?.alreadyUsed === true || result?.status === 'already_used') {
        const msg = result.message || 'This receipt has already been used and cannot be reused.';
        return { verified: false, alreadyUsed: true, message: msg };
      }
      return {
        verified: result?.valid === true || result?.status === 'valid',
        alreadyUsed: false,
        message: result?.message,
      };
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err?.message || '';
      if (errMsg.toLowerCase().includes('already been used') || errMsg.toLowerCase().includes('already used')) {
        return {
          verified: false,
          alreadyUsed: true,
          message: errMsg || 'This receipt has already been used and cannot be reused.',
        };
      }
      return { verified: false };
    }
  };

  /* ─── Payment Submission ────────────────────── */
  const handlePaymentSubmitted = async (paymentDetails: {
    paymentMethod: string;
    paymentRef: string;
    paymentScreenshot?: string;
    receiptUrl?: string;
  }) => {
    if (!regData) return;

    setError(null);
    setSubmitting(true);

    const totalAmount = selectedPlan.price * effectiveNumCompanies;

    if (isRenewal) {
      const effectivePhone =
        regData.phone ||
        renewalPhone ||
        (typeof window !== 'undefined'
          ? localStorage.getItem('auth_phone') || localStorage.getItem('last_login_phone')
          : '') ||
        '';

      if (!effectivePhone) {
        setSubmitting(false);
        setShowPaymentModal(false);
        setError('Please enter your account phone number to complete renewal.');
        return;
      }

      try {
        const verifyRes = await tryVerifyReceipt(paymentDetails);
        if (verifyRes.alreadyUsed) {
          const usedMsg = verifyRes.message || 'This receipt has already been used and cannot be reused. Please check your receipt or use a different payment.';
          showToast(usedMsg, 'error');
          throw new Error(usedMsg);
        }

        await api.renewSubscription({
          phone: effectivePhone,
          planId: selectedPlan.id,
          planTitle: selectedPlan.title,
          planAmount: totalAmount,
          planPeriod: selectedPlan.period,
          paymentMethod: paymentDetails.paymentMethod,
          paymentRef: paymentDetails.paymentRef,
          paymentScreenshot: paymentDetails.paymentScreenshot,
        });

        if (verifyRes.verified) {
          showToast('Payment verified successfully! Your account is active. Please sign in.', 'success');
          router.push(`/login?verified=true&phone=${encodeURIComponent(effectivePhone)}`);
          return;
        }

        showToast('Renewal submitted. Waiting for admin approval.', 'info');
        const approvalPayload = {
          companyName: regData.companyName || 'Business Renewal',
          phone: effectivePhone,
          planTitle: selectedPlan.title,
          planAmount: totalAmount,
          numCompanies: effectiveNumCompanies,
          paymentMethod: paymentDetails.paymentMethod,
          paymentRef: paymentDetails.paymentRef,
        };

        const params = new URLSearchParams();
        params.set('approvalData', btoa(JSON.stringify(approvalPayload)));
        router.push(`/awaiting-approval?${params.toString()}`);
        return;
      } catch (err: any) {
        setSubmitting(false);
        const msg = err?.response?.data?.message || err?.message || 'Subscription renewal failed. Please try again.';
        showToast(msg, 'error');
        if (msg.toLowerCase().includes('already been used') || msg.toLowerCase().includes('already used')) {
          throw new Error(msg);
        }
        setShowPaymentModal(false);
        setError(msg);
        return;
      }
    }

    const nameSource = (regData.ownerName || regData.companyName || '').trim();
    const ownerParts = nameSource.split(/\s+/).filter(Boolean);
    const firstName = ownerParts[0] || 'Business';
    const lastName = ownerParts.slice(1).join(' ') || '';

    try {
      // Try receipt auto-verification
      const verifyRes = await tryVerifyReceipt(paymentDetails);
      if (verifyRes.alreadyUsed) {
        const usedMsg = verifyRes.message || 'This receipt has already been used and cannot be reused. Please check your receipt or use a different payment.';
        showToast(usedMsg, 'error');
        throw new Error(usedMsg);
      }

      const verified = verifyRes.verified;

      await api.register({
        email: regData.email,
        password: regData.password,
        firstName,
        lastName,
        phone: regData.phone,
        companyName: regData.companyName,
        address: regData.address,
        numCompanies: effectiveNumCompanies,
        planId: selectedPlan.id,
        planTitle: selectedPlan.title,
        planAmount: totalAmount,
        planPeriod: selectedPlan.period,
        paymentMethod: paymentDetails.paymentMethod,
        paymentRef: paymentDetails.paymentRef,
        paymentScreenshot: paymentDetails.paymentScreenshot,
        receiptVerified: verified,
        receiptUrl: paymentDetails.receiptUrl,
      });

      const isTrial = selectedPlan.price === 0 || selectedPlan.period === 'trial' || selectedPlan.id.includes('trial');
      if (isTrial) {
        showToast('Free trial activated! 14 days of access.', 'success');
        router.push('/login?trial=true');
        return;
      }

      if (verified) {
        // Receipt verified — redirect to sign-in
        showToast('Payment receipt verified successfully! Your account is active. Please sign in.', 'success');
        router.push(`/login?verified=true&phone=${encodeURIComponent(regData.phone || '')}`);
        return;
      }

      // Receipt not verified — go to admin for approval
      showToast('Payment submitted. Your account is pending admin approval.', 'info');
      const approvalPayload = {
        companyName: regData.companyName,
        phone: regData.phone,
        ownerName: regData.ownerName,
        planTitle: selectedPlan.title,
        planAmount: totalAmount,
        numCompanies: effectiveNumCompanies,
        paymentMethod: paymentDetails.paymentMethod,
        paymentRef: paymentDetails.paymentRef,
      };

      const params = new URLSearchParams();
      params.set('approvalData', btoa(JSON.stringify(approvalPayload)));
      router.push(`/awaiting-approval?${params.toString()}`);

    } catch (err: any) {
      setSubmitting(false);
      const msg = err?.response?.data?.message || err?.message || 'Registration failed. Please try again.';
      showToast(msg, 'error');
      if (msg.toLowerCase().includes('already been used') || msg.toLowerCase().includes('already used')) {
        throw new Error(msg);
      }
      setShowPaymentModal(false);
      setError(msg);
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
    <div className="stock-chart-bg min-h-screen w-full flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-4xl bg-white rounded-[24px] shadow-2xl p-6 sm:p-10 relative z-10 animate-fade-in border border-white/20 my-4">

        {/* Back Button */}
        <button
          type="button"
          onClick={() => router.back()}
          className="absolute top-8 left-8 text-slate-400 hover:text-slate-700 transition-colors p-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center mb-8 text-center">
          <img
            src="/logo/gelagle_logo_horizontal.png"
            alt="BM Stock Logo"
            className="h-12 object-contain mb-3"
            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
          />
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {isRenewal ? 'Renew Your Subscription Plan' : 'Choose Your Plan'}
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-md">
            {isRenewal
              ? 'Select a plan and submit payment verification to renew your BM Stock subscription.'
              : 'Select the subscription package that fits your business needs.'}
          </p>

          {/* Renewal account identifier if applicable */}
          {isRenewal && regData?.phone && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <div className="px-3.5 py-1.5 bg-slate-100 border border-slate-200 rounded-full text-xs text-slate-700 flex items-center gap-1.5">
                <span className="font-medium text-slate-500">Account:</span>
                <span className="font-bold text-slate-900">{regData.phone}</span>
              </div>
            </div>
          )}

          {/* Inline Phone input fallback if phone missing on renewal */}
          {isRenewal && !regData?.phone && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl max-w-md w-full mx-auto text-left">
              <label className="block text-xs font-bold text-amber-900 mb-1.5">
                Enter Account Phone Number to Link Renewal:
              </label>
              <input
                type="tel"
                placeholder="e.g. +251 980256702 or 0980256702"
                onChange={(e) => {
                  const val = e.target.value.trim();
                  setRegData((prev) => ({ ...prev, phone: val }));
                  if (typeof window !== 'undefined' && val) {
                    localStorage.setItem('auth_phone', val);
                    localStorage.setItem('last_login_phone', val);
                  }
                }}
                className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#025EA7]"
              />
            </div>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-center gap-3 text-sm text-red-600 font-medium">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Plan Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {plans.map((plan) => {
            const isSelected = selectedPlan.id === plan.id;
            const isLarge = isLargeBusinessPlan(plan);
            const planCompanies = isLarge ? Math.max(1, largePlanCompanies) : 1;
            const totalForPlan = plan.price * planCompanies;

            return (
              <div
                key={plan.id}
                onClick={() => setSelectedPlan(plan)}
                className={`rounded-2xl p-6 transition-all cursor-pointer relative flex flex-col justify-between border-2 ${
                  isSelected
                    ? 'bg-[#0F2A47] text-white border-[#025EA7] shadow-xl shadow-blue-950/30 scale-[1.02]'
                    : 'bg-white text-slate-900 border-slate-200 hover:border-slate-300 shadow-sm'
                }`}
              >
                {/* Badge if any */}
                {plan.badge && (
                  <div className={`absolute -top-3 right-6 px-3 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase ${
                    isSelected ? 'bg-amber-400 text-slate-950' : 'bg-[#025EA7] text-white'
                  }`}>
                    {plan.badge}
                  </div>
                )}

                <div>
                  <h3 className={`text-lg font-bold ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                    {plan.title}
                  </h3>

                  {/* Price */}
                  <div className="mt-3 mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className={`text-xs font-semibold ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                        ETB
                      </span>
                      <span className="text-3xl font-black tracking-tight">
                        {formatPrice(totalForPlan)}
                      </span>
                    </div>
                    {isLarge ? (
                      <div className={`text-[11px] mt-1 ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>
                        {planCompanies > 1
                          ? `ETB ${formatPrice(plan.price)} × ${planCompanies} companies`
                          : `ETB ${formatPrice(plan.price)} / company / year`}
                      </div>
                    ) : (
                      <div className={`text-[11px] mt-1 ${isSelected ? 'text-slate-400' : 'text-slate-500'}`}>
                        {plan.price === 0 ? '14 Days Free' : '1 Company Slot'}
                      </div>
                    )}
                  </div>

                  {/* Features List */}
                  <div className="space-y-2.5 border-t pt-4 border-slate-200/20 text-xs">
                    {plan.features.map((feat, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${isSelected ? 'text-blue-400' : 'text-[#025EA7]'}`} />
                        <span className={isSelected ? 'text-slate-200' : 'text-slate-600'}>
                          {feat}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Select Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPlan(plan);
                    const isTrial = plan.price === 0 || plan.period === 'trial' || plan.id.includes('trial');
                    if (isTrial) {
                      setShowTrialModal(true);
                    } else {
                      setShowPaymentModal(true);
                    }
                  }}
                  className={`w-full mt-6 py-3 px-4 font-bold rounded-xl text-xs uppercase tracking-wider transition-all ${
                    isSelected
                      ? 'bg-white text-[#0F2A47] hover:bg-slate-100 shadow-md'
                      : 'bg-[#025EA7] text-white hover:bg-[#014883]'
                  }`}
                >
                  {plan.price === 0 || plan.period === 'trial' ? 'Start Free Trial' : 'Select Plan'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Large Business Multi-Company Configuration */}
        {isSelectedLarge && (
          <div className="mb-6 p-4 sm:p-5 bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-blue-50/90 border border-blue-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-fade-in shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-[#025EA7] text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/20">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900">How many companies to add?</h4>
                  <span className="px-2 py-0.5 bg-blue-100 text-[#025EA7] rounded-full text-[10px] font-extrabold uppercase tracking-wide">
                    Large Business Exclusive
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Multi-company ownership is exclusive to the Large Business plan (ETB {formatPrice(selectedPlan.price)}/year per company).
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-blue-200 shadow-xs shrink-0">
              <button
                type="button"
                onClick={() => setLargePlanCompanies((prev) => Math.max(1, prev - 1))}
                disabled={largePlanCompanies <= 1}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-slate-700 flex items-center justify-center transition-colors text-base select-none"
              >
                −
              </button>
              <div className="flex flex-col items-center">
                <input
                  type="text"
                  inputMode="numeric"
                  value={largePlanCompanies}
                  onChange={(e) => {
                    const val = parseInt(e.target.value.replace(/\D/g, ''));
                    setLargePlanCompanies(isNaN(val) || val < 1 ? 1 : Math.min(val, 99));
                  }}
                  className="w-12 text-center text-base font-extrabold text-[#025EA7] focus:outline-none"
                />
                <span className="text-[10px] text-slate-400 font-semibold uppercase -mt-1">
                  {largePlanCompanies === 1 ? 'Company' : 'Companies'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLargePlanCompanies((prev) => Math.min(99, prev + 1))}
                className="w-8 h-8 rounded-lg bg-blue-100 hover:bg-blue-200 font-bold text-[#025EA7] flex items-center justify-center transition-colors text-base select-none"
              >
                +
              </button>
            </div>
          </div>
        )}

        {/* Footer info banner */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#025EA7]" />
            <span>Secure payment verification by BM Stock Admin</span>
          </div>
          <button
            type="button"
            onClick={() => {
              const isTrial = selectedPlan.price === 0 || selectedPlan.period === 'trial' || selectedPlan.id.includes('trial');
              if (isTrial) {
                setShowTrialModal(true);
              } else {
                setShowPaymentModal(true);
              }
            }}
            className="text-[#025EA7] font-bold hover:underline"
          >
            Proceed with {selectedPlan.title} {isSelectedLarge && effectiveNumCompanies > 1 ? `(${effectiveNumCompanies} companies)` : ''} →
          </button>
        </div>

      </div>

      {/* Trial Confirmation Modal */}
      {showTrialModal && (
        <TrialConfirmationModal
          plan={selectedPlan}
          submitting={submitting}
          onClose={() => setShowTrialModal(false)}
          onConfirm={() => {
            handlePaymentSubmitted({
              paymentMethod: 'Free Trial',
              paymentRef: `FREE_TRIAL_${Date.now()}`,
            });
          }}
        />
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <PaymentModal
          plan={selectedPlan}
          numCompanies={effectiveNumCompanies}
          onClose={() => setShowPaymentModal(false)}
          onSubmitPayment={handlePaymentSubmitted}
        />
      )}
    </div>
  );
}
