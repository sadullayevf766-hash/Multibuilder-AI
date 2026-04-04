import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export interface ProjectRecord {
  id: string;
  user_id: string;
  name: string;
  description: string;
  drawing_data: any;
  created_at: string;
  updated_at: string;
}

export async function saveProject(userId: string, name: string, description: string, drawingData: any) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: userId,
      name,
      description,
      drawing_data: drawingData
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getProjectHistory(userId: string) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getProject(projectId: string) {
  if (!supabase) {
    throw new Error('Supabase not configured');
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single();

  if (error) throw error;
  return data;
}
