import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// ── Stripe client (lazy) ──────────────────────────────────────────
let _stripe: InstanceType<typeof Stripe> | null = null;
export function getStripe(): InstanceType<typeof Stripe> {
  if (_stripe) return _stripe;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not set');
  _stripe = new Stripe(key);
  return _stripe;
}

// ── Plan → Stripe Price ID mapping ───────────────────────────────
// Stripe Dashboard → Products → Pro/Business → Copy Price ID
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

// Har plan uchun berilgan credit
const PLAN_CREDITS: Record<string, number> = {
  pro:      500,
  business: 2000,
};

function getSb() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

// Plan yoqish — checkout.session.completed da chaqiriladi
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

// Plan o'chirish — subscription cancelled da
export async function downgradePlan(userId: string) {
  const sb = getSb();
  await sb.from('profiles').update({
    plan_id:                'free',
    stripe_subscription_id: null,
    subscription_status:    'cancelled',
    updated_at:             new Date().toISOString(),
  }).eq('id', userId);
}

// Oylik credit yangilash — invoice.paid (subscription_cycle) da
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
