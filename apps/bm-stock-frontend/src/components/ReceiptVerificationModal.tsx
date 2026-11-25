"use client";

import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  Search,
  Upload,
  Link as LinkIcon,
  QrCode,
  ShieldCheck,
  AlertTriangle,
  Loader2,
  ArrowRight,
  ChevronDown,
} from 'lucide-react';
import { api, VerifiedReceipt } from '@/lib/api';
import { decodeQrFromImageFile } from '@/lib/qrScanner';
import { SUPPORTED_BANKS, getBankInfo } from '@/lib/receiptBanks';

interface ReceiptVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLinkOrRef?: string;
  defaultBank?: string;
  onApplyReceipt?: (receipt: VerifiedReceipt) => void;
}

function normalizePhone(value: string): string {
  const digits = value.replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('251')) return digits;
  if (digits.startsWith('0')) return `251${digits.slice(1)}`;
  if (digits.length === 9 && digits.startsWith('9')) return `251${digits}`;
  return digits;
}

export default function ReceiptVerificationModal({
  isOpen,
  onClose,
  initialLinkOrRef = '',
  defaultBank = 'cbe',
  onApplyReceipt,
}: ReceiptVerificationModalProps) {
  const [selectedBankId, setSelectedBankId] = useState(defaultBank);
  const [activeTab, setActiveTab] = useState<'link' | 'image'>('link');
  const [linkInput, setLinkInput] = useState(initialLinkOrRef);
  const [suffixInput, setSuffixInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedLink, setExtractedLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifiedReceipt | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bank = useMemo(() => getBankInfo(selectedBankId), [selectedBankId]);

  if (!isOpen) return null;

  const fieldValue = (key: 'suffix' | 'phoneNumber') =>
    key === 'suffix' ? suffixInput : phoneInput;

  const setFieldValue = (key: 'suffix' | 'phoneNumber', value: string) => {
    if (key === 'suffix') setSuffixInput(value);
    else setPhoneInput(value);
  };

  const isUrl = (value: string) => /^https?:\/\//i.test(value.trim());

  const validate = (): string | null => {
    if (!linkInput.trim()) return `Please enter the ${bank.primaryLabel.toLowerCase()}.`;
    for (const field of bank.fields) {
      if (field.required && !fieldValue(field.key).trim()) {
        return `Please enter the ${field.label.toLowerCase()}.`;
      }
    }
    return null;
  };

  const runVerify = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setResult(null);
      return;
    }
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const primary = linkInput.trim();
      const res = await api.verifyReceipt({
        bank: selectedBankId,
        reference: primary,
        receiptUrl: isUrl(primary) ? primary : undefined,
        suffix: suffixInput.trim() || undefined,
        phoneNumber: phoneInput.trim() ? normalizePhone(phoneInput) : undefined,
      });
      setResult(res);
    } catch (err: any) {
      setResult({
        valid: false,
        status: 'error',
        message: err?.message || 'Verification failed.',
        bank: selectedBankId,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setResult(null);
    setError(null);

    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);

    setLoading(true);
    try {
      const qrData = await decodeQrFromImageFile(file);
      if (qrData) {
        setExtractedLink(qrData);
        setLinkInput(qrData);
        const res = await api.verifyReceipt({ bank: selectedBankId, reference: qrData, receiptUrl: qrData });
        setResult(res);
      } else {
        setExtractedLink(null);
        const res = await api.verifyReceipt({ file, bank: selectedBankId });
        setResult(res);
      }
    } catch {
      // Fallback silently; result stays null
    } finally {
      setLoading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setLinkInput(text.trim());
    } catch {
      // Clipboard permissions denied
    }
  };

  const handleReset = () => {
    setLinkInput('');
    setSuffixInput('');
    setPhoneInput('');
    setSelectedFile(null);
    setImagePreview(null);
    setExtractedLink(null);
    setError(null);
    setResult(null);
  };

  const selectBank = (id: string) => {
    setSelectedBankId(id);
    setResult(null);
    setError(null);
    setSuffixInput('');
    setPhoneInput('');
  };

  const resultBank = result ? getBankInfo(result.bank) : bank;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl max-w-xl w-full max-h-[92vh] overflow-y-auto shadow-2xl border border-slate-100 flex flex-col">
        {/* Header */}
        <div className="relative p-6 border-b border-slate-100 bg-[#025EA7] text-white rounded-t-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
                <ShieldCheck className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-extrabold tracking-tight">Receipt Verification</h3>
                  <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-[#025EA7] px-2 py-0.5 rounded-full">
                    Official
                  </span>
                </div>
                <p className="text-xs text-blue-100 mt-0.5">
                  Verify CBE, Telebirr, Dashen, M-Pesa, Awash &amp; more
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="flex bg-white/10 p-1 rounded-xl mt-5 border border-white/10">
            <button
              onClick={() => setActiveTab('link')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'link'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <LinkIcon className="w-3.5 h-3.5" />
              Link / Reference
            </button>
            <button
              onClick={() => setActiveTab('image')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                activeTab === 'image'
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Screenshot / Screen
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6 flex-1">
          {/* Bank Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">Bank / Wallet</label>
            <div className="relative">
              <span
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full pointer-events-none"
                style={{ backgroundColor: bank.color }}
              />
              <select
                value={selectedBankId}
                onChange={(e) => selectBank(e.target.value)}
                className="w-full appearance-none pl-9 pr-9 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#025EA7] transition-all cursor-pointer"
              >
                {SUPPORTED_BANKS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            </div>
            {bank.note && (
              <div className="mt-2 flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{bank.note}</span>
              </div>
            )}
          </div>

          {activeTab === 'link' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  {bank.primaryLabel}
                </label>
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runVerify()}
                    placeholder={bank.primaryPlaceholder}
                    className="w-full pl-3.5 pr-20 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#025EA7] transition-all"
                  />
                  <button
                    type="button"
                    onClick={handlePaste}
                    className="absolute right-2 px-2.5 py-1.5 text-[11px] font-bold text-[#025EA7] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    Paste
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">
                  Paste the official {bank.shortName} link or type the reference exactly as printed.
                </p>
              </div>

              {/* Dynamic secondary fields */}
              {bank.fields.map((field) => (
                <div key={field.key} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {field.label}
                    {field.required && <span className="text-rose-500"> *</span>}
                  </label>
                  <input
                    type="text"
                    inputMode={field.numeric ? 'numeric' : 'text'}
                    value={fieldValue(field.key)}
                    onChange={(e) => setFieldValue(field.key, e.target.value)}
                    placeholder={field.placeholder}
                    maxLength={field.maxLength}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#025EA7]"
                  />
                </div>
              ))}

              {error && (
                <div className="flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-700">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={runVerify}
                disabled={loading || !linkInput.trim()}
                className="w-full py-3.5 bg-[#025EA7] hover:bg-[#014883] text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying with {bank.shortName}...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Verify {bank.shortName} Receipt
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {!imagePreview ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-[#025EA7] rounded-2xl p-8 text-center cursor-pointer bg-slate-50 hover:bg-blue-50/30 transition-all group"
                >
                  <div className="w-14 h-14 rounded-2xl bg-blue-100 text-[#025EA7] flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform shadow-inner">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div className="text-xs font-bold text-slate-800">
                    Click to browse or drop {bank.shortName} receipt screenshot
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    PNG, JPG, or WebP up to 10MB
                  </div>
                </div>
              ) : (
                <div className="relative border border-slate-200 rounded-2xl p-3 bg-slate-50 flex flex-col items-center">
                  <img
                    src={imagePreview}
                    alt="Receipt preview"
                    className="max-h-56 object-contain rounded-xl shadow-sm mb-3"
                  />
                  {extractedLink && (
                    <div className="w-full bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 mb-3 flex items-center gap-2 text-xs text-emerald-800 font-semibold">
                      <QrCode className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="truncate">Detected QR Link: {extractedLink}</span>
                    </div>
                  )}
                  <div className="flex gap-2 w-full">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors"
                    >
                      Choose Different Image
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      className="px-3 py-2 text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VERIFICATION RESULT DISPLAY */}
          {loading && (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100">
              <Loader2 className="w-8 h-8 text-[#025EA7] animate-spin mx-auto mb-3" />
              <div className="text-xs font-bold text-slate-800">Checking with Bank Rails...</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Authenticating transaction authenticity with {bank.shortName}
              </div>
            </div>
          )}

          {result && !loading && (
            <div className="animate-scale-in">
              {result.status === 'pending' ? (
                /* PENDING CARD */
                <div className="bg-amber-50/80 border-2 border-amber-500 rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shrink-0">
                      <Loader2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-wider text-amber-800">
                        STILL PROCESSING
                      </div>
                      <div className="text-[11px] font-bold text-amber-600">
                        {resultBank.name}
                      </div>
                    </div>
                  </div>
                  <div className="p-3 bg-white/90 rounded-xl border border-amber-200 text-xs text-amber-900">
                    <div className="font-bold">{result.message}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => runVerify()}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    Check Again
                  </button>
                </div>
              ) : result.valid ? (
                /* VALID RECEIPT CARD */
                <div className="bg-emerald-50/70 border-2 border-emerald-500 rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-emerald-200/80">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black uppercase tracking-wider text-emerald-800">
                            VALID RECEIPT
                          </span>
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        </div>
                        <div className="text-[11px] font-bold text-emerald-600">
                          {resultBank.name}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-400">Amount</div>
                      <div className="text-lg font-black text-emerald-700">
                        ETB {result.amount?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Payer / Sender</span>
                      <span className="font-bold text-slate-900 block truncate">
                        {result.senderName || 'N/A'}
                      </span>
                      {result.payerAccount && (
                        <span className="text-[10px] font-mono text-slate-500 block">
                          Acc: {result.payerAccount}
                        </span>
                      )}
                    </div>

                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Receiver</span>
                      <span className="font-bold text-slate-900 block truncate">
                        {result.receiverName || 'N/A'}
                      </span>
                      {result.receiverAccount && (
                        <span className="text-[10px] font-mono text-slate-500 block">
                          Acc: {result.receiverAccount}
                        </span>
                      )}
                    </div>

                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Reference</span>
                      <span className="font-mono font-bold text-slate-900 block truncate">
                        {result.reference || result.receiptNumber || 'N/A'}
                      </span>
                    </div>

                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Transaction Date</span>
                      <span className="font-semibold text-slate-700 block truncate">
                        {result.transactionDate
                          ? new Date(result.transactionDate).toLocaleString()
                          : 'Confirmed'}
                      </span>
                    </div>
                  </div>

                  {result.reason && (
                    <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100 text-xs">
                      <span className="text-[10px] font-bold text-slate-400 block uppercase">Remark / Reason</span>
                      <span className="font-medium text-slate-700 block italic">
                        "{result.reason}"
                      </span>
                    </div>
                  )}

                  {onApplyReceipt && (
                    <button
                      type="button"
                      onClick={() => {
                        onApplyReceipt(result);
                        onClose();
                      }}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition-colors flex items-center justify-center gap-2 mt-2"
                    >
                      <span>Apply Verified Amount to Sale (ETB {result.amount})</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : (
                /* INVALID RECEIPT CARD */
                <div className="bg-rose-50/80 border-2 border-rose-500 rounded-2xl p-5 shadow-sm space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-md shrink-0">
                      <XCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase tracking-wider text-rose-800">
                        INVALID RECEIPT
                      </div>
                      <div className="text-[11px] font-bold text-rose-600">
                        {resultBank.name} — Transaction Not Verified
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-white/90 rounded-xl border border-rose-200 text-xs text-rose-900 space-y-1.5">
                    <div className="font-bold">{result.message}</div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      This receipt was not found in {resultBank.name} official records or could not be verified. Do NOT fulfill this order until payment is verified.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleReset}
                    className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors"
                  >
                    Try Another Receipt
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 rounded-b-3xl">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Real-time banking rail check powered by verify.et</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
