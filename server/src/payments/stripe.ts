/*
 * Stripe integration — pure fetch, no npm package needed.
 * This avoids module resolution issues in monorepo deployments.
 */
import { createClient } from '@supabase/supabase-js';

const STRIPE_API = 'https://api.stripe.com/v1';

function stripeKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not set');
  return key;
}

function authHeader() {
  return 'Basic ' + Buffer.from(stripeKey() + ':').toString('base64');
}

async function stripePost(path: string, params: Record<string, string>): Promise<Record<string, unknown>> {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': authHeader(),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as Record<string, string>)?.message ?? `Stripe error ${res.status}`);
  return data;
}

async function stripeGet(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    headers: { 'Authorization': authHeader() },
  });
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) throw new Error((data.error as Record<string, string>)?.message ?? `Stripe error ${res.status}`);
  return data;
}

// ── Webhook signature verification ───────────────────────────────
import { createHmac, timingSafeEqual } from 'crypto';

export function verifyWebhookSignature(payload: Buffer, signature: string, secret: string): Record<string, unknown> {
  const parts = Object.fromEntries(signature.split(',').map(p => p.split('='))) as Record<string, string>;
  const timestamp = parts['t'];
  const sig = parts['v1'];
  if (!timestamp || !sig) throw new Error('Invalid signature header');

  // Replay attack prevention — 5 min window
  const diff = Math.abs(Date.now() / 1000 - parseInt(timestamp));
  if (diff > 300) throw new Error('Webhook timestamp too old');

  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${payload.toString()}`)
    .digest('hex');

  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) {
    throw new Error('Webhook signature mismatch');
  }

  return JSON.parse(payload.toString()) as Record<string, unknown>;
}

// ── Plan → Price ID mapping ───────────────────────────────────────
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

// ── Customer upsert ───────────────────────────────────────────────
export async function findOrCreateCustomer(userId: string, email: string): Promise<string> {
  const sb = getSb();
  const { data: profile } = await sb.from('profiles').select('stripe_customer_id').eq('id', userId).single();
  if (profile?.stripe_customer_id) return profile.stripe_customer_id as string;

  const customer = await stripePost('/customers', {
    email,
    'metadata[supabase_user_id]': userId,
  });
  const customerId = customer.id as string;
  await sb.from('profiles').update({ stripe_customer_id: customerId }).eq('id', userId);
  return customerId;
}

// ── Checkout session ──────────────────────────────────────────────
export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  userId: string,
  plan: string,
  appUrl: string,
): Promise<string> {
  const session = await stripePost('/checkout/sessions', {
    customer:                         customerId,
    'payment_method_types[]':         'card',
    'line_items[0][price]':           priceId,
    'line_items[0][quantity]':        '1',
    mode:                             'subscription',
    success_url:                      `${appUrl}/dashboard?payment=success&plan=${plan}`,
    cancel_url:                       `${appUrl}/pricing?payment=cancelled`,
    'metadata[supabase_user_id]':     userId,
    'metadata[plan]':                 plan,
    'subscription_data[metadata][supabase_user_id]': userId,
    'subscription_data[metadata][plan]':             plan,
  });
  return session.url as string;
}

// ── Billing portal ────────────────────────────────────────────────
export async function createPortalSession(customerId: string, appUrl: string): Promise<string> {
  const session = await stripePost('/billing_portal/sessions', {
    customer:   customerId,
    return_url: `${appUrl}/dashboard`,
  });
  return session.url as string;
}

// ── Supabase helper ───────────────────────────────────────────────
function getSb() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
}

const PLAN_CREDITS: Record<string, number> = { pro: 500, business: 2000 };

export async function upgradePlan(
  userId: string, planId: 'pro' | 'business',
  stripeCustomerId: string, stripeSubscriptionId: string,
) {
  const sb = getSb();
  const credits = PLAN_CREDITS[planId] ?? 500;
  await sb.from('profiles').update({
    plan_id: planId, credits,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: stripeSubscriptionId,
    subscription_status: 'active',
    updated_at: new Date().toISOString(),
  }).eq('id', userId);
  await sb.from('credit_transactions').insert({
    user_id: userId, amount: credits, balance: credits,
    action: 'purchase', description: `${planId.toUpperCase()} plan aktivlashtirildi`,
    metadata: { plan: planId, stripe_sub: stripeSubscriptionId },
  });
}

export async function downgradePlan(userId: string) {
  const sb = getSb();
  await sb.from('profiles').update({
    plan_id: 'free', stripe_subscription_id: null,
    subscription_status: 'cancelled', updated_at: new Date().toISOString(),
  }).eq('id', userId);
}

export async function renewCredits(userId: string, planId: string) {
  const sb = getSb();
  const credits = PLAN_CREDITS[planId] ?? 500;
  const { data: profile } = await sb.from('profiles').select('credits').eq('id', userId).single();
  const newBalance = (profile?.credits ?? 0) + credits;
  await sb.from('profiles').update({ credits: newBalance, updated_at: new Date().toISOString() }).eq('id', userId);
  await sb.from('credit_transactions').insert({
    user_id: userId, amount: credits, balance: newBalance,
    action: 'monthly_renewal', description: `${planId.toUpperCase()} — oylik credit`,
  });
}

// Dummy export for compatibility
export function getStripe() { return null; }
