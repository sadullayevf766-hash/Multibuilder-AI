/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js';

// Stripe ni dynamic require — type deklaratsiyasiz ishlaydi
// eslint-disable-next-line @typescript-eslint/no-var-requires
const StripeLib = require('stripe');

// ── Stripe client (lazy) ──────────────────────────────────────────
let _stripe: any = null;

export function getStripe(): any {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not set');
  _stripe = new StripeLib(key);
  return _stripe;
}

// ── Plan → Stripe Price ID mapping ───────────────────────────────
export const STRIPE_PRICES: Record<string, { monthly: string; yearly: string }> = {
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? '',
    yearly:  process.env.STRIPE_PRICE_PRO_YEARLY  ?? '',
  },
  business: {
    monthly: process.env.STRIPE_PRICE_BIZ_MONTHLY ?? '',
    yearly:  process.env.STRIPE_PRICE_BIZ_YEARLY  ?? '',
  },
};

const PLAN_CREDITS: Record<string, number> = {
  pro:      500,
  business: 2000,
};

function getSb() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

export async function upgradePlan(
  userId: string,
  planId: 'pro' | 'business',
  stripeCustomerId: string,
  stripeSubscriptionId: string,
) {
  const sb = getSb();
  const credits = PLAN_CREDITS[planId] ?? 500;

  await sb.from('profiles').update({
    plan_id:                planId,
    credits,
    stripe_customer_id:     stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    subscription_status:    'active',
    updated_at:             new Date().toISOString(),
  }).eq('id', userId);

  await sb.from('credit_transactions').insert({
    user_id:     userId,
    amount:      credits,
    balance:     credits,
    action:      'purchase',
    description: `${planId.toUpperCase()} plan aktivlashtirildi`,
    metadata:    { plan: planId, stripe_sub: stripeSubscriptionId },
  });
}

export async function downgradePlan(userId: string) {
  const sb = getSb();
  await sb.from('profiles').update({
    plan_id:                'free',
    stripe_subscription_id: null,
    subscription_status:    'cancelled',
    updated_at:             new Date().toISOString(),
  }).eq('id', userId);
}

export async function renewCredits(userId: string, planId: string) {
  const sb = getSb();
  const credits = PLAN_CREDITS[planId] ?? 500;

  const { data: profile } = await sb
    .from('profiles')
    .select('credits')
    .eq('id', userId)
    .single();

  const newBalance = (profile?.credits ?? 0) + credits;

  await sb.from('profiles').update({
    credits:    newBalance,
    updated_at: new Date().toISOString(),
  }).eq('id', userId);

  await sb.from('credit_transactions').insert({
    user_id:     userId,
    amount:      credits,
    balance:     newBalance,
    action:      'monthly_renewal',
    description: `${planId.toUpperCase()} — oylik credit`,
  });
}
