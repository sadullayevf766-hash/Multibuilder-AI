import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

// ── Local dev store (fallback when Supabase RLS blocks) ───────────────────────
// cwd() = repo root when nx/npm workspace, but = server/ when tsx runs directly.
// Use a path relative to this source file so it's always resolved correctly.
const DEV_STORE_PATH = join(__dirname, '..', '..', 'dev-projects.json');

function readDevStore(): Record<string, unknown>[] {
  if (!existsSync(DEV_STORE_PATH)) return [];
  try { return JSON.parse(readFileSync(DEV_STORE_PATH, 'utf-8')); } catch { return []; }
}

function writeDevStore(rows: Record<string, unknown>[]) {
  writeFileSync(DEV_STORE_PATH, JSON.stringify(rows, null, 2), 'utf-8');
}

function devInsert(row: Record<string, unknown>) {
  const rows = readDevStore();
  const now = new Date().toISOString();
  const record = { id: randomUUID(), created_at: now, updated_at: now, deleted_at: null, ...row };
  rows.push(record);
  writeDevStore(rows);
  return record;
}

function devUpdate(id: string, patch: Record<string, unknown>) {
  const rows = readDevStore();
  const idx = rows.findIndex(r => r.id === id);
  if (idx === -1) throw new Error('Dev store: project not found');
  rows[idx] = { ...rows[idx], ...patch, updated_at: new Date().toISOString() };
  writeDevStore(rows);
  return rows[idx];
}

function devGetById(id: string) {
  return readDevStore().find(r => r.id === id) ?? null;
}

function devGetByUser(userId: string) {
  return readDevStore().filter(r => r.user_id === userId && !r.deleted_at);
}

function devSoftDelete(id: string) {
  devUpdate(id, { deleted_at: new Date().toISOString() });
}

function devGetTrash(userId: string) {
  return readDevStore().filter(r => r.user_id === userId && r.deleted_at);
}

// Evaluated lazily so dotenv has already loaded when this runs
function isDevKey() {
  return process.env.SUPABASE_SERVICE_KEY?.startsWith('sb_publishable_')
    || process.env.NODE_ENV === 'development';
}

function isRlsError(msg: string) {
  return msg.includes('row-level security') || msg.includes('violates') || msg.includes('policy');
}

// Lazy singleton with service key (for reads that bypass RLS)
let _serviceClient: SupabaseClient | null = null;

function getServiceClient(): SupabaseClient {
  if (_serviceClient) return _serviceClient;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error(`Supabase not configured. URL=${url ? 'set' : 'missing'}, KEY=${key ? 'set' : 'missing'}`);
  }

  _serviceClient = createClient(url, key);
  return _serviceClient;
}

// Create a client authenticated as the user (respects RLS with user's JWT)
function getUserClient(userToken: string): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) throw new Error('Supabase not configured');

  return createClient(url, key, {
    global: {
      headers: { Authorization: userToken }
    }
  });
}

export interface ProjectRecord {
  id: string;
  user_id: string;
  name: string;
  drawing_data: unknown;
  created_at: string;
  updated_at: string;
}

// Mega project — drawing_data ichida saqlanadi
export interface MegaProjectData {
  project_type: 'mega';
  spec: unknown;
  generations: unknown;          // Record<MegaDiscipline, GenerationState>
  chatHistory: unknown[];
  editHistory: unknown[];
  savedAt: string;
}

export async function saveMegaProject(
  userId: string,
  name: string,
  megaData: MegaProjectData,
  authHeader?: string
) {
  const sb = authHeader ? getUserClient(authHeader) : getServiceClient();
  const { data, error } = await sb
    .from('projects')
    .insert({ user_id: userId, name, drawing_data: megaData })
    .select()
    .single();
  if (error) {
    if (isRlsError(error.message) || isDevKey()) {
      // Dev fallback: local JSON store
      return devInsert({ user_id: userId, name, drawing_data: megaData });
    }
    throw new Error(error.message);
  }
  return data;
}

export async function updateMegaProject(
  id: string,
  megaData: MegaProjectData,
  authHeader?: string
) {
  const sb = authHeader ? getUserClient(authHeader) : getServiceClient();
  const { data, error } = await sb
    .from('projects')
    .update({ drawing_data: megaData })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    if (isRlsError(error.message) || isDevKey()) {
      return devUpdate(id, { drawing_data: megaData });
    }
    throw new Error(error.message);
  }
  return data;
}

export async function saveProject(
  userId: string,
  name: string,
  initialPrompt: string,
  drawingData: unknown,
  authHeader?: string
) {
  const sb = authHeader ? getUserClient(authHeader) : getServiceClient();

  const messages = initialPrompt ? [{ role: 'user', content: initialPrompt }] : [];

  const { data, error } = await sb
    .from('projects')
    .insert({ user_id: userId, name, drawing_data: drawingData, messages })
    .select()
    .single();

  if (error) {
    if (error.message.includes('messages')) {
      const { data: d2, error: e2 } = await sb
        .from('projects')
        .insert({ user_id: userId, name, drawing_data: drawingData })
        .select()
        .single();
      if (e2) {
        if (isRlsError(e2.message) || isDevKey())
          return devInsert({ user_id: userId, name, drawing_data: drawingData });
        throw new Error(e2.message);
      }
      return d2;
    }
    if (isRlsError(error.message) || isDevKey())
      return devInsert({ user_id: userId, name, drawing_data: drawingData });
    throw new Error(error.message);
  }
  return data;
}

export async function getProjectHistory(userId: string, authHeader?: string) {
  // Dev store items always included
  const devItems = isDevKey() ? devGetByUser(userId) : [];

  const sb = authHeader ? getUserClient(authHeader) : getServiceClient();

  const { data, error } = await sb
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error && error.message.includes('deleted_at')) {
    const { data: allData, error: allError } = await sb
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (allError) return devItems;
    return [...(allData || []), ...devItems];
  }

  if (error) return devItems;
  return [...(data || []), ...devItems].sort(
    (a, b) => new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
  );
}

export async function getProject(projectId: string, authHeader?: string) {
  // Check dev store first
  if (isDevKey()) {
    const devRow = devGetById(projectId);
    if (devRow) return devRow;
  }

  const sb = authHeader ? getUserClient(authHeader) : getServiceClient();

  const { data, error } = await sb
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Loyiha topilmadi');
  return data;
}

export async function renameProject(id: string, name: string, authHeader?: string) {
  if (isDevKey() && devGetById(id)) return devUpdate(id, { name });

  const sb = authHeader ? getUserClient(authHeader) : getServiceClient();
  const { data, error } = await sb
    .from('projects')
    .update({ name })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    if (isRlsError(error.message) || isDevKey()) return devUpdate(id, { name });
    throw new Error(error.message);
  }
  return data;
}

export async function softDeleteProject(id: string, authHeader?: string) {
  if (isDevKey() && devGetById(id)) { devSoftDelete(id); return; }

  const sb = authHeader ? getUserClient(authHeader) : getServiceClient();
  const { error } = await sb
    .from('projects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error && error.message.includes('deleted_at')) {
    const { error: delError } = await sb.from('projects').delete().eq('id', id);
    if (delError) throw new Error(delError.message);
    return;
  }
  if (isRlsError(error?.message ?? '') || isDevKey()) { devSoftDelete(id); return; }
  if (error) throw new Error(error.message);
}

export async function restoreProject(id: string, authHeader?: string) {
  if (isDevKey() && devGetById(id)) return devUpdate(id, { deleted_at: null });

  const sb = authHeader ? getUserClient(authHeader) : getServiceClient();
  const { data, error } = await sb
    .from('projects')
    .update({ deleted_at: null })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    if (isRlsError(error.message) || isDevKey()) return devUpdate(id, { deleted_at: null });
    throw new Error(error.message);
  }
  return data;
}

export async function hardDeleteProject(id: string, authHeader?: string) {
  if (isDevKey() && devGetById(id)) {
    const rows = readDevStore().filter(r => r.id !== id);
    writeDevStore(rows);
    return;
  }

  const sb = authHeader ? getUserClient(authHeader) : getServiceClient();
  const { error } = await sb.from('projects').delete().eq('id', id);
  if (error) {
    if (isRlsError(error.message) || isDevKey()) {
      const rows = readDevStore().filter(r => r.id !== id);
      writeDevStore(rows);
      return;
    }
    throw new Error(error.message);
  }
}

export async function getTrash(userId: string, authHeader?: string) {
  const devTrash = isDevKey() ? devGetTrash(userId) : [];

  const sb = authHeader ? getUserClient(authHeader) : getServiceClient();
  const { data, error } = await sb
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  if (error && (error.message.includes('deleted_at') || isRlsError(error.message))) return devTrash;
  if (error) return devTrash;
  return [...(data || []), ...devTrash];
}

export async function updateProjectDrawing(
  id: string,
  drawingData: unknown,
  messages: Array<{ role: string; content: string }>,
  authHeader?: string
) {
  // Dev store shortcut
  if (isDevKey() && devGetById(id)) return devUpdate(id, { drawing_data: drawingData });

  const sb = authHeader ? getUserClient(authHeader) : getServiceClient();
  const { data, error } = await sb
    .from('projects')
    .update({ drawing_data: drawingData, messages })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    if (error.message.includes('messages')) {
      const { data: d2, error: e2 } = await sb
        .from('projects')
        .update({ drawing_data: drawingData })
        .eq('id', id)
        .select()
        .single();
      if (e2) {
        if (isRlsError(e2.message) || isDevKey()) return devUpdate(id, { drawing_data: drawingData });
        throw new Error(e2.message);
      }
      return d2;
    }
    if (isRlsError(error.message) || isDevKey()) return devUpdate(id, { drawing_data: drawingData });
    throw new Error(error.message);
  }
  return data;
}
