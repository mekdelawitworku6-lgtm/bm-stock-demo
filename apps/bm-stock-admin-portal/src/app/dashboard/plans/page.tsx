'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  CreditCard,
  Plus,
  Loader2,
  AlertCircle,
  RefreshCw,
  Pencil,
  Trash2,
  Check,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';

interface Plan {
  id: string;
  title: string;
  price: string;
  amount: number;
  period: string;
  features: string[];
  moreCount: number;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface PlanForm {
  title: string;
  price: string;
  amount: string;
  period: string;
  features: string;
  moreCount: string;
  sortOrder: string;
  isActive: boolean;
}

const EMPTY_FORM: PlanForm = {
  title: '',
  price: '',
  amount: '',
  period: '',
  features: '',
  moreCount: '0',
  sortOrder: '1',
  isActive: true,
};

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PlanForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const showFlash = (msg: string) => {
    setFlash(msg);
    window.setTimeout(() => setFlash(null), 3000);
  };

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/plans/admin');
      setPlans(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, sortOrder: String(plans.length + 1) });
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingId(plan.id);
    setForm({
      title: plan.title,
      price: plan.price,
      amount: String(plan.amount),
      period: plan.period || '',
      features: (plan.features || []).join('\n'),
      moreCount: String(plan.moreCount ?? 0),
      sortOrder: String(plan.sortOrder ?? 0),
      isActive: plan.isActive,
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    setFormError(null);
    const amount = Number(form.amount);
    const moreCount = Number(form.moreCount || 0);
    const sortOrder = Number(form.sortOrder || 0);
    if (!form.title.trim()) {
      setFormError('Title is required');
      return;
    }
    if (form.amount === '' || isNaN(amount) || amount < 0) {
      setFormError('A valid amount (ETB) is required');
      return;
    }
    const payload = {
      title: form.title.trim(),
      price: form.price.trim() || String(amount),
      amount,
      period: form.period.trim(),
      features: form.features.split('\n').map((f) => f.trim()).filter(Boolean),
      moreCount,
      sortOrder,
      isActive: form.isActive,
    };
    setSaving(true);
    try {
      if (editingId) {
        await api.patch(`/plans/admin/${editingId}`, payload);
        showFlash('Plan updated successfully');
      } else {
        await api.post('/plans/admin', payload);
        showFlash('Plan created successfully');
      }
      setShowModal(false);
      await fetchPlans();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (plan: Plan) => {
    if (!window.confirm(`Delete "${plan.title}"? This cannot be undone.`)) return;
    setDeletingId(plan.id);
    try {
      await api.delete(`/plans/admin/${plan.id}`);
      showFlash('Plan deleted');
      await fetchPlans();
    } catch (err: any) {
      setError(err.message || 'Failed to delete plan');
    } finally {
      setDeletingId(null);
    }
  };

  const updateForm = (key: keyof PlanForm, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setInput = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    updateForm(e.target.name as keyof PlanForm, e.target.value);
  };

  return (
    <div className="space-y-8 animate-fadeIn bg-white">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <CreditCard className="w-6 h-6 text-[#025EA7]" />
            <h1 className="text-2xl font-bold text-slate-900">Subscription Plans</h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage the plans shown in the mobile app. Changes reflect immediately on registration.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={fetchPlans}
            className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition flex items-center space-x-2 cursor-pointer text-sm font-semibold"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={openCreate}
            className="px-4 py-3 bg-[#025EA7] hover:bg-[#024A85] text-white rounded-xl transition flex items-center space-x-2 cursor-pointer text-sm font-semibold shadow-md shadow-blue-600/20"
          >
            <Plus className="w-4 h-4" />
            <span>New Plan</span>
          </button>
        </div>
      </div>

      {flash && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center space-x-2 text-emerald-700 text-sm font-semibold animate-fadeIn">
          <Check className="w-5 h-5" />
          <span>{flash}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start space-x-3 text-red-700 text-sm animate-fadeIn">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Plans grid */}
      {loading ? (
        <div className="py-16 text-center text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#025EA7] mb-2" />
          <p className="text-sm font-medium">Loading plans...</p>
        </div>
      ) : plans.length === 0 && !error ? (
        <div className="py-16 text-center text-slate-500 bg-white rounded-2xl border border-slate-200">
          <CreditCard className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <p className="font-semibold text-slate-700">No plans yet</p>
          <p className="text-xs text-slate-400 mt-1">Create your first subscription plan</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition ${
                plan.isActive ? 'border-blue-200' : 'border-slate-200 opacity-70'
              }`}
            >
              <div className="bg-[#025EA7] p-5 text-white relative">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-200">
                      {plan.period || 'Plan'}
                    </p>
                    <h3 className="text-xl font-bold mt-1">{plan.title}</h3>
                    <div className="flex items-baseline mt-2">
                      <span className="text-3xl font-extrabold">{plan.price}</span>
                      <span className="text-blue-200 text-sm ml-1">ETB</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => openEdit(plan)}
                      title="Edit plan"
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition cursor-pointer"
                    >
                      <Pencil className="w-4 h-4 text-white" />
                    </button>
                    <button
                      onClick={() => handleDelete(plan)}
                      disabled={deletingId === plan.id}
                      title="Delete plan"
                      className="p-2 bg-white/10 hover:bg-red-500/80 rounded-lg transition cursor-pointer disabled:opacity-50"
                    >
                      {deletingId === plan.id ? (
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4 text-white" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex items-center space-x-2">
                  {plan.isActive ? (
                    <span className="inline-flex items-center px-2.5 py-1 bg-emerald-400/20 text-emerald-100 text-xs font-semibold rounded-full">
                      <Eye className="w-3 h-3 mr-1" /> Visible in app
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-1 bg-white/10 text-blue-100 text-xs font-semibold rounded-full">
                      <EyeOff className="w-3 h-3 mr-1" /> Hidden
                    </span>
                  )}
                  <span className="px-2.5 py-1 bg-white/10 text-blue-100 text-xs font-semibold rounded-full">
                    Sort {plan.sortOrder}
                  </span>
                </div>
              </div>

              <div className="p-5">
                <ul className="space-y-2">
                  {(plan.features || []).slice(0, 4).map((f, i) => (
                    <li key={i} className="flex items-start space-x-2 text-sm text-slate-600">
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                  {plan.moreCount > 0 && (
                    <li className="flex items-start space-x-2 text-sm text-slate-500 font-medium">
                      <Plus className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                      <span>+{plan.moreCount} more benefits</span>
                    </li>
                  )}
                </ul>
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                  <span>Amount: {plan.amount.toLocaleString()} ETB</span>
                  <span>{plan.features?.length || 0} features</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-fadeIn">
            <div className="bg-[#025EA7] p-5 text-white flex items-center justify-between">
              <h3 className="text-lg font-bold">{editingId ? 'Edit Plan' : 'Create Plan'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-lg cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2 text-red-700 text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Title</label>
                <input
                  name="title"
                  value={form.title}
                  onChange={setInput}
                  placeholder="e.g. For 1 Month"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#025EA7] text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Price Label</label>
                  <input
                    name="price"
                    value={form.price}
                    onChange={setInput}
                    placeholder="e.g. 399"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#025EA7] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Amount (ETB)</label>
                  <input
                    name="amount"
                    type="number"
                    min="0"
                    value={form.amount}
                    onChange={setInput}
                    placeholder="e.g. 399"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#025EA7] text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Period</label>
                <input
                  name="period"
                  value={form.period}
                  onChange={setInput}
                  placeholder="e.g. 1_month"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#025EA7] text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Features (one per line)</label>
                <textarea
                  name="features"
                  value={form.features}
                  onChange={setInput}
                  rows={5}
                  placeholder={'Companies allowed: Unlimited\nUnlimited staff accounts\n...'}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#025EA7] text-sm resize-y"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">More Benefits Count</label>
                  <input
                    name="moreCount"
                    type="number"
                    min="0"
                    value={form.moreCount}
                    onChange={setInput}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#025EA7] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Sort Order</label>
                  <input
                    name="sortOrder"
                    type="number"
                    min="0"
                    value={form.sortOrder}
                    onChange={setInput}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-[#025EA7] text-sm"
                  />
                </div>
              </div>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => updateForm('isActive', e.target.checked)}
                  className="w-5 h-5 accent-[#025EA7]"
                />
                <span className="text-sm font-medium text-slate-700">Visible in mobile app</span>
              </label>
            </div>

            <div className="p-6 pt-0 flex items-center justify-end space-x-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 bg-[#025EA7] hover:bg-[#024A85] text-white rounded-xl text-sm font-semibold flex items-center space-x-2 disabled:opacity-60 cursor-pointer"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{saving ? 'Saving...' : 'Save Plan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
