export type SubscriptionPeriodUnit = 'minutes' | 'days' | 'months';

export interface ParsedPlanPeriod {
  unit: SubscriptionPeriodUnit;
  value: number;
}

/** Check if the plan is a free trial plan */
export function isTrialPlan(planPeriod?: string | null): boolean {
  if (!planPeriod) return false;
  const raw = planPeriod.toLowerCase().trim();
  return raw.includes('trial') || raw.includes('free') || raw.includes('14_day') || raw.includes('two_week');
}

/** Check if the plan is a Large Business plan (supports multiple companies) */
export function isLargeBusinessPlan(planPeriodOrTitle?: string | null): boolean {
  if (!planPeriodOrTitle) return false;
  const raw = planPeriodOrTitle.toLowerCase().trim();
  if (
    isTrialPlan(raw) ||
    raw.includes('small') ||
    raw.includes('starter') ||
    raw.includes('7999') ||
    raw.includes('medium') ||
    raw.includes('growth') ||
    raw.includes('10999')
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

/** Parse plan period strings like `trial`, `14_days`, `5_minutes`, `1_month`, `6_months`, `1_year`. */
export function parsePlanPeriod(planPeriod?: string | null): ParsedPlanPeriod {
  const raw = (planPeriod || '1_month').toLowerCase().trim();

  if (isTrialPlan(raw)) {
    return { unit: 'days', value: 14 };
  }

  const minuteMatch = raw.match(/^(\d+)_minutes?$/);
  if (minuteMatch) {
    return { unit: 'minutes', value: Math.max(1, parseInt(minuteMatch[1], 10)) };
  }

  if (raw.includes('year') || raw.includes('12')) {
    return { unit: 'months', value: 12 };
  }
  if (raw.includes('6')) {
    return { unit: 'months', value: 6 };
  }
  if (raw.includes('month') && !raw.includes('year')) {
    if (raw.includes('3')) return { unit: 'months', value: 3 };
    return { unit: 'months', value: 1 };
  }
  // Default all paid plans to 1 year except trials
  return { unit: 'months', value: 12 };
}

export function addSubscriptionPeriod(start: Date, planPeriod?: string | null): Date {
  const parsed = parsePlanPeriod(planPeriod);
  const result = new Date(start);

  if (parsed.unit === 'minutes') {
    result.setMinutes(result.getMinutes() + parsed.value);
    return result;
  }

  if (parsed.unit === 'days') {
    result.setDate(result.getDate() + parsed.value);
    return result;
  }

  result.setMonth(result.getMonth() + parsed.value);
  return result;
}

/** When to send the renewal reminder before expiry. */
export function getSubscriptionReminderLead(planPeriod?: string | null): {
  unit: 'minutes' | 'days';
  value: number;
} {
  if (isTrialPlan(planPeriod)) {
    // 14-day trial: On the 10th day, exactly 4 days remain before expiry
    return { unit: 'days', value: 4 };
  }

  const parsed = parsePlanPeriod(planPeriod);

  if (parsed.unit === 'minutes') {
    const lead = parsed.value > 20 ? parsed.value - 20 : Math.max(1, Math.round(parsed.value / 3));
    return { unit: 'minutes', value: lead };
  }

  if (parsed.unit === 'months') {
    return { unit: 'days', value: 30 };
  }

  return { unit: 'days', value: 7 };
}

export function getSubscriptionNextPaymentDate(expiresAt: Date, planPeriod?: string | null): Date {
  const lead = getSubscriptionReminderLead(planPeriod);
  const next = new Date(expiresAt);

  if (lead.unit === 'minutes') {
    next.setMinutes(next.getMinutes() - lead.value);
    return next;
  }

  next.setDate(next.getDate() - lead.value);
  return next;
}

export function isShortTestPlan(planPeriod?: string | null): boolean {
  return parsePlanPeriod(planPeriod).unit === 'minutes';
}


