"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Hourglass, CheckCircle2, Info, Building2,
  Phone as PhoneIcon, CreditCard, ArrowRight
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function AwaitingApprovalPage() {
  return (
    <Suspense fallback={
      <div className="stock-chart-bg min-h-screen w-full flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <AwaitingApprovalInner />
    </Suspense>
  );
}

function AwaitingApprovalInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [approvalData, setApprovalData] = useState<Record<string, any> | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [simulationSuccess, setSimulationSuccess] = useState(false);

  useEffect(() => {
    const encoded = searchParams.get('approvalData');
    if (encoded) {
      try {
        setApprovalData(JSON.parse(atob(encoded)));
      } catch {
        setApprovalData(null);
      }
    }
  }, [searchParams]);

  const companyName = approvalData?.companyName || 'Your Business';
  const phone = approvalData?.phone || '';
  const refNo = approvalData?.paymentRef || 'GS-REG-8942103';
  const planTitle = approvalData?.planTitle || 'Subscription Plan';
  const paymentMethod = approvalData?.paymentMethod || 'Telebirr';

  /* Simulate Admin Approval for demo/test */
  const handleSimulateApproval = async () => {
    setSimulating(true);
    setTimeout(async () => {
      setSimulationSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 1200);
    }, 1000);
  };

  return (
    <div className="stock-chart-bg min-h-screen w-full flex items-center justify-center p-4">
      <div className="w-full max-w-[500px] bg-white rounded-[24px] shadow-2xl p-8 md:p-10 relative z-10 animate-fade-in border border-white/20 my-8">

        {/* Brand Logo Header */}
        <div className="flex flex-col items-center mb-6 text-center">
          <img
            src="/logo/gelagle_logo_horizontal.png"
            alt="BM Stock Logo"
            className="h-12 object-contain mb-4"
            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
          />

          {/* Icon Badge */}
          <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 border-2 border-amber-200 flex items-center justify-center mb-4 shadow-sm">
            {simulationSuccess ? (
              <CheckCircle2 className="w-8 h-8 text-green-600 animate-bounce" />
            ) : (
              <Hourglass className="w-8 h-8 text-amber-600 animate-pulse" />
            )}
          </div>

          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {simulationSuccess ? 'Account Approved' : 'Awaiting Approval'}
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-sm leading-relaxed">
            {simulationSuccess
              ? 'Your business registration has been activated by Admin. Redirecting to your dashboard...'
              : 'We have received your business registration & payment screenshot. Our team is verifying your payment details.'}
          </p>
        </div>

        {/* Status Info Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 space-y-3 text-xs">
          
          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
            <span className="text-slate-500 font-medium">Business Name:</span>
            <span className="font-bold text-slate-900">{companyName}</span>
          </div>

          {phone && (
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-slate-500 font-medium">Phone:</span>
              <span className="font-mono font-semibold text-slate-800">{phone}</span>
            </div>
          )}

          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
            <span className="text-slate-500 font-medium">Selected Package:</span>
            <span className="font-bold text-[#025EA7]">{planTitle}</span>
          </div>

          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
            <span className="text-slate-500 font-medium">Payment Reference:</span>
            <span className="font-mono font-semibold text-slate-800">{refNo}</span>
          </div>

          <div className="flex items-start gap-2 pt-1 text-slate-700 bg-blue-50/80 p-2.5 rounded-xl border border-blue-100">
            <Info className="w-4 h-4 text-[#025EA7] shrink-0 mt-0.5" />
            <span className="font-medium text-[11px] leading-tight">
              Status: Admin Document & Payment Verification in progress.
            </span>
          </div>

        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link
            href="/login"
            className="w-full py-3.5 px-4 bg-[#025EA7] hover:bg-[#014883] active:scale-[0.99] text-white font-semibold rounded-xl shadow-lg shadow-blue-900/20 transition-all text-xs flex items-center justify-center gap-2"
          >
            <span>Back to Login</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          {/* Demo button to simulate admin approval */}
          <button
            type="button"
            onClick={handleSimulateApproval}
            disabled={simulating || simulationSuccess}
            className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 active:scale-[0.99] text-slate-700 font-bold rounded-xl text-xs transition-all border border-slate-200 flex items-center justify-center gap-2"
          >
            {simulating ? (
              <div className="w-4 h-4 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>Simulate Admin Approval</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
