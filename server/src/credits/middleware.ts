import type { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { CREDIT_COSTS, type CreditAction } from './config';

// Service role client — RLS bypass
function getServiceClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

// JWT dan user_id olish
async function getUserIdFromToken(authHeader?: string): Promise<string | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const sb = getServiceClient();
    const { data } = await sb.auth.getUser(token);
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

// User profil + plan ma'lumotlari
export async function getUserProfile(userId: string) {
  const sb = getServiceClient();
  const { data, error } = await sb.rpc('get_user_profile', { p_user_id: userId });
  if (error || !data?.[0]) return null;
  return data[0] as {
    id: string; email: string; plan_id: string; credits: number;
    credits_reset_at: string; total_generated: number;
    plan_name: string; credits_per_week: number; credits_per_month: number;
    max_projects: number; max_mega_modules: number;
    has_dxf_export: boolean; has_watermark: boolean;
  };
}

// Weekly reset tekshirish
async function checkAndResetWeeklyCredits(userId: string) {
  const sb = getServiceClient();
  const { data: profile } = await sb
    .from('profiles')
    .select('plan_id, credits_reset_at, credits_per_week:plans(credits_per_week)')
    .eq('id', userId)
    .single();

  if (!profile) return;
  const resetAt = new Date(profile.credits_reset_at as string);
  if (resetAt <= new Date() && profile.plan_id === 'free') {
    await sb.rpc('reset_weekly_credits');
  }
}

// Credits ayirish
export async function deductCredits(
  userId: string,
  action: CreditAction,
  description?: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; newBalance: number; message: string }> {
  const amount = CREDIT_COSTS[action];
  const sb = getServiceClient();

  const { data, error } = await sb.rpc('deduct_credits', {
    p_user_id:    userId,
    p_amount:     amount,
    p_action:     action,
    p_description: description ?? action,
    p_metadata:   metadata ?? {},
  });

  if (error || !data?.[0]) {
    return { success: false, newBalance: 0, message: error?.message ?? 'Xatolik' };
  }

  const row = data[0] as { success: boolean; new_balance: number; message: string };
  return { success: row.success, newBalance: row.new_balance, message: row.message };
}

// ── Express middleware factory ────────────────────────────────────
export function requireCredits(action: CreditAction) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    // Dev mode: no auth header → skip credit check
    if (!authHeader && process.env.NODE_ENV !== 'production') {
      (req as Request & { userId?: string; skipCredits?: boolean }).skipCredits = true;
      return next();
    }

    const userId = await getUserIdFromToken(authHeader);
    if (!userId) {
      return res.status(401).json({
        error: 'Tizimga kirish talab qilinadi',
        code: 'UNAUTHORIZED',
      });
    }

    // Weekly reset tekshirish
    await checkAndResetWeeklyCredits(userId);

    const profile = await getUserProfile(userId);
    if (!profile) {
      return res.status(404).json({ error: 'Profil topilmadi', code: 'NO_PROFILE' });
    }

    const cost = CREDIT_COSTS[action];

    // Credit yetarliligini tekshirish
    if (profile.credits < cost) {
      return res.status(402).json({
        error: 'Credit yetarli emas',
        code: 'INSUFFICIENT_CREDITS',
        required: cost,
        available: profile.credits,
        plan: profile.plan_id,
        upgradeUrl: '/pricing',
      });
    }

    // DXF eksport — faqat Pro+
    if ((action === 'super_export_dxf' || action === 'mega_export_dxf') && !profile.has_dxf_export) {
      return res.status(403).json({
        error: "DXF eksport faqat Pro va Business planlarda mavjud",
        code: 'PLAN_LIMIT_DXF',
        upgradeUrl: '/pricing',
      });
    }

    // Credits ayirish
    const result = await deductCredits(userId, action, undefined, { endpoint: req.path });
    if (!result.success) {
      return res.status(402).json({
        error: result.message,
        code: 'INSUFFICIENT_CREDITS',
        required: cost,
        available: profile.credits,
        upgradeUrl: '/pricing',
      });
    }

    // req ga userId va yangi balans qo'shish
    const r = req as Request & {
      userId: string; creditBalance: number; userProfile: typeof profile;
    };
    r.userId = userId;
    r.creditBalance = result.newBalance;
    r.userProfile = profile;

    next();
  };
}

// ── Standalone credit check (middleware siz) ──────────────────────
export async function checkCreditsFromRequest(
  req: Request
): Promise<{ userId: string | null; profile: Awaited<ReturnType<typeof getUserProfile>> }> {
  const userId = await getUserIdFromToken(req.headers.authorization);
  if (!userId) return { userId: null, profile: null };
  const profile = await getUserProfile(userId);
  return { userId, profile };
}
