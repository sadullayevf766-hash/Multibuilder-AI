import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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

export async function saveProject(
  userId: string,
  name: string,
  initialPrompt: string,
  drawingData: unknown,
  authHeader?: string
) {
  const sb = authHeader ? getUserClient(authHeader) : getServiceClient();

  // Initial message history
  const messages = initialPrompt
    ? [{ role: 'user', content: initialPrompt }]
    : [];

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
      if (e2) throw new Error(e2.message);
      return d2;
    }
    throw new Error(error.message);
  }
  return data;
}

export async function getProjectHistory(userId: string, authHeader?: string) {
  const sb = authHeader ? getUserClient(authHeader) : getServiceClient();

  // Try with deleted_at filter first, fallback to without it
  let query = sb
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  const { data, error } = await query.is('deleted_at', null);

  // If deleted_at column doesn't exist yet, fetch all
  if (error && error.message.includes('deleted_at')) {
    const { data: allData, error: allError } = await sb
      .from('projects')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (allError) throw new Error(allError.message);
    return allData || [];
  }

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getProject(projectId: string, authHeader?: string) {
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
  const sb = authHeader ? getUserClient(authHeader) : getServiceClient();
  const { data, error } = await sb
    .from('projects')
    .update({ name })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function softDeleteProject(id: string, authHeader?: string) {
  const sb = authHeader ? getUserClient(authHeader) : getServiceClient();
  const { error } = await sb
    .from('projects')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error && error.message.includes('deleted_at')) {
    // Column doesn't exist — do hard delete instead
    const { error: delError } = await sb.from('projects').delete().eq('id', id);
    if (delError) throw new Error(delError.message);
    return;
  }
  if (error) throw new Error(error.message);
}

export async function restoreProject(id: string, authHeader?: string) {
  const sb = authHeader ? getUserClient(authHeader) : getServiceClient();
  const { data, error } = await sb
    .from('projects')
    .update({ deleted_at: null })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function hardDeleteProject(id: string, authHeader?: string) {
  const sb = authHeader ? getUserClient(authHeader) : getServiceClient();
  const { error } = await sb
    .from('projects')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getTrash(userId: string, authHeader?: string) {
  const sb = authHeader ? getUserClient(authHeader) : getServiceClient();
  const { data, error } = await sb
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false });

  // If column doesn't exist yet, return empty
  if (error && error.message.includes('deleted_at')) return [];
  if (error) throw new Error(error.message);
  return data || [];
}

export async function updateProjectDrawing(
  id: string,
  drawingData: unknown,
  messages: Array<{ role: string; content: string }>,
  authHeader?: string
) {
  const sb = authHeader ? getUserClient(authHeader) : getServiceClient();
  const { data, error } = await sb
    .from('projects')
    .update({ drawing_data: drawingData, messages })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    // messages column may not exist — update only drawing_data
    if (error.message.includes('messages')) {
      const { data: d2, error: e2 } = await sb
        .from('projects')
        .update({ drawing_data: drawingData })
        .eq('id', id)
        .select()
        .single();
      if (e2) throw new Error(e2.message);
      return d2;
    }
    throw new Error(error.message);
  }
  return data;
}
