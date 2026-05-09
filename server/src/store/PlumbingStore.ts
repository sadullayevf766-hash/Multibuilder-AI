/**
 * PlumbingStore — Supabase + in-memory fallback
 *
 * Supabase plumbing_projects table mavjud bo'lsa — u yerga saqlaydi.
 * Mavjud bo'lmasa (table yaratilmagan) — in-memory fallback.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { PlumbingProject } from '../engine/PlumbingProjectEngine';

export class PlumbingStore {
  private sb: SupabaseClient | null = null;
  private mem = new Map<string, PlumbingProject>();
  private useDb = false;
  private checked = false;

  constructor(supabaseUrl: string, serviceKey: string) {
    if (supabaseUrl && serviceKey) {
      this.sb = createClient(supabaseUrl, serviceKey);
    }
  }

  // Table mavjudligini bir marta tekshirish
  private async ensureChecked(): Promise<void> {
    if (this.checked) return;
    this.checked = true;
    if (!this.sb) return;
    try {
      const { error } = await this.sb
        .from('plumbing_projects')
        .select('id')
        .limit(1);
      if (!error) {
        this.useDb = true;
        console.log('[PlumbingStore] Supabase plumbing_projects OK');
      } else {
        console.log('[PlumbingStore] Supabase table yo\'q, in-memory fallback:', error.message);
      }
    } catch {
      console.log('[PlumbingStore] Supabase xato, in-memory fallback');
    }
  }

  private storeKey(userId: string, projectId: string) {
    return `${userId}:${projectId}`;
  }

  async save(userId: string, project: PlumbingProject): Promise<void> {
    await this.ensureChecked();
    const key = this.storeKey(userId, project.id);

    // Always update in-memory (cache)
    this.mem.set(key, project);

    if (this.useDb && this.sb) {
      try {
        const { error } = await this.sb
          .from('plumbing_projects')
          .upsert({
            id:          project.id,
            user_id:     userId,
            name:        project.name,
            description: project.description ?? '',
            data:        project as unknown as Record<string, unknown>,
            updated_at:  new Date().toISOString(),
          }, { onConflict: 'id' });
        if (error) console.warn('[PlumbingStore] upsert error:', error.message);
      } catch (e) {
        console.warn('[PlumbingStore] save exception:', (e as Error).message);
      }
    }
  }

  async get(userId: string, projectId: string): Promise<PlumbingProject | null> {
    await this.ensureChecked();
    const key = this.storeKey(userId, projectId);

    // In-memory cache
    if (this.mem.has(key)) return this.mem.get(key)!;
    // anon fallback
    const anonKey = this.storeKey('anon', projectId);
    if (this.mem.has(anonKey)) return this.mem.get(anonKey)!;

    if (this.useDb && this.sb) {
      try {
        const { data, error } = await this.sb
          .from('plumbing_projects')
          .select('data')
          .or(`id.eq.${projectId}`)
          .or(`user_id.eq.${userId},user_id.eq.anon`)
          .eq('id', projectId)
          .single();
        if (!error && data?.data) {
          const project = data.data as unknown as PlumbingProject;
          this.mem.set(key, project);
          return project;
        }
      } catch (e) {
        console.warn('[PlumbingStore] get exception:', (e as Error).message);
      }
    }
    return null;
  }

  async list(userId: string): Promise<PlumbingProject[]> {
    await this.ensureChecked();

    if (this.useDb && this.sb) {
      try {
        const { data, error } = await this.sb
          .from('plumbing_projects')
          .select('data, updated_at')
          .or(`user_id.eq.${userId},user_id.eq.anon`)
          .order('updated_at', { ascending: false })
          .limit(50);
        if (!error && data) {
          const projects = data.map(row => row.data as unknown as PlumbingProject);
          // cache
          projects.forEach(p => this.mem.set(this.storeKey(userId, p.id), p));
          return projects;
        }
      } catch (e) {
        console.warn('[PlumbingStore] list exception:', (e as Error).message);
      }
    }

    // in-memory fallback
    const prefix = `${userId}:`;
    const anonPrefix = 'anon:';
    const results: PlumbingProject[] = [];
    for (const [k, v] of this.mem) {
      if (k.startsWith(prefix) || k.startsWith(anonPrefix)) results.push(v);
    }
    return results.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async delete(userId: string, projectId: string): Promise<void> {
    const key = this.storeKey(userId, projectId);
    this.mem.delete(key);
    if (this.useDb && this.sb) {
      try {
        await this.sb
          .from('plumbing_projects')
          .delete()
          .eq('id', projectId)
          .eq('user_id', userId);
      } catch {}
    }
  }
}
