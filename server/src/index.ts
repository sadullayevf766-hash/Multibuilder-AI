import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { join } from 'path';
import { GeminiParser } from './ai/GeminiParser';
import { FloorPlanEngine } from './engine/FloorPlanEngine';
import { WarmFloorEngine, parseWarmFloorRooms } from './engine/WarmFloorEngine';
import { WaterSupplyEngine, parseWaterRooms } from './engine/WaterSupplyEngine';
import { SewageEngine, parseSewageRooms } from './engine/SewageEngine';
import { StormDrainEngine, parseStormRooms } from './engine/StormDrainEngine';
import { BoilerRoomEngine } from './engine/BoilerRoomEngine';
import { MegaPlannerParser } from './ai/MegaPlannerParser';
import { FacadeEngine, parseFacadeInput } from './engine/FacadeEngine';
import { PlumbingEngine } from './engine/PlumbingEngine';
import { ElectricalEngine } from './engine/ElectricalEngine';
import { ArchitectureEngine } from './engine/ArchitectureEngine';
import { DecorEngine } from './engine/DecorEngine';
import { exportToDxf } from './export/DxfExporter';
import { PdfExporter } from './export/PdfExporter';
import { saveProject, getProjectHistory, getProject, renameProject, softDeleteProject, restoreProject, hardDeleteProject, getTrash, updateProjectDrawing, saveMegaProject, updateMegaProject } from './db/supabase';

// Try loading from server/.env first, then fallback to .env in cwd
dotenv.config({ path: join(process.cwd(), 'server', '.env') });
dotenv.config({ path: join(process.cwd(), '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve client static files in production
if (process.env.NODE_ENV === 'production') {
  // process.cwd() = repo root on Render
  const clientDist = join(process.cwd(), 'client', 'dist');
  app.use(express.static(clientDist));
}

const warmFloorEngine   = new WarmFloorEngine();
const waterSupplyEngine = new WaterSupplyEngine();
const sewageEngine      = new SewageEngine();
const stormDrainEngine  = new StormDrainEngine();
const boilerRoomEngine  = new BoilerRoomEngine();
const megaPlanner       = new MegaPlannerParser(process.env.GEMINI_API_KEY || '');
const facadeEngine      = new FacadeEngine();

const geminiParser = new GeminiParser(
  process.env.GEMINI_API_KEY || '',
  process.env.GROQ_API_KEY || ''
);
const floorPlanEngine = new FloorPlanEngine();
const plumbingEngine = new PlumbingEngine();
const electricalEngine = new ElectricalEngine();
const architectureEngine = new ArchitectureEngine();
const decorEngine = new DecorEngine();
const pdfExporter = new PdfExporter();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/generate', async (req, res) => {
  try {
    const { description, drawingType, floorCount } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    // Plumbing axonometric schema
    if (drawingType === 'plumbing-axonometric') {
      const schema = plumbingEngine.generate(description);
      const drawingData = {
        id: schema.id,
        walls: [], fixtures: [], pipes: [], dimensions: [], doors: [],
        drawingType: 'plumbing-axonometric' as const,
        plumbingSchema: schema,
      };
      return res.json({ drawingData });
    }

    // Architecture drawing — parse with Gemini then run ArchitectureEngine
    if (drawingType === 'architecture') {
      const parsed = await geminiParser.parseDescription(description);
      const archData = 'rooms' in parsed
        ? architectureEngine.generateFromFloorPlan(parsed)
        : architectureEngine.generateFromRoom(parsed);
      return res.json({ archData });
    }

    // Electrical floor plan — parse with Gemini then run ElectricalEngine
    if (drawingType === 'electrical-floor-plan') {
      const parsed = await geminiParser.parseDescription(description);
      const electricalData = 'rooms' in parsed
        ? electricalEngine.generateFromFloorPlan(parsed)
        : electricalEngine.generateFromRoom(parsed);
      return res.json({ electricalData });
    }

    // Default: floor plan
    const parsed = await geminiParser.parseDescription(description);

    // Step 2: Generate drawing data
    let drawingData;
    if ('rooms' in parsed) {
      // Multi-room FloorPlan
      drawingData = floorPlanEngine.generateFloorPlan(parsed);
      return res.json({ floorPlan: parsed, drawingData });
    } else {
      // Single room RoomSpec
      drawingData = floorPlanEngine.generateDrawing(parsed);
      return res.json({ roomSpec: parsed, drawingData });
    }
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate floor plan',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ── Super Drawing: Issiq pol isitish tizimi ───────────────────────────────────
app.post('/api/generate-warm-floor', async (req, res) => {
  try {
    const { description } = req.body;
    console.log('[WARM-FLOOR] description:', (description || '').slice(0, 80));

    const rooms  = parseWarmFloorRooms(description || '');
    const schema = warmFloorEngine.generate(rooms);

    console.log(`[WARM-FLOOR] ${schema.floors.length} qavat, ${rooms.length} xona, ${schema.totalHeatW} W`);
    return res.json({ schema });
  } catch (err) {
    console.error('[WARM-FLOOR] Error:', err);
    res.status(500).json({ error: 'Issiq pol sxemasini yaratishda xatolik', message: (err as Error).message });
  }
});

// ── Suv ta'minoti sxemasi ─────────────────────────────────────────────────────
app.post('/api/generate-water-supply', async (req, res) => {
  try {
    const { description } = req.body;
    console.log('[WATER-SUPPLY] description:', (description || '').slice(0, 80));
    const rooms  = parseWaterRooms(description || '');
    const schema = waterSupplyEngine.generate(rooms);
    console.log(`[WATER-SUPPLY] ${schema.floors.length} qavat, ${schema.totalFixtures} jihoz, ${schema.totalRisers} stoyak`);
    return res.json({ schema });
  } catch (err) {
    console.error('[WATER-SUPPLY] Error:', err);
    res.status(500).json({ error: 'Suv ta\'minoti sxemasini yaratishda xatolik', message: (err as Error).message });
  }
});

// ── Kanalizatsiya sxemasi ─────────────────────────────────────────────────────
app.post('/api/generate-sewage', async (req, res) => {
  try {
    const { description } = req.body;
    console.log('[SEWAGE] description:', (description || '').slice(0, 80));
    const rooms  = parseSewageRooms(description || '');
    const schema = sewageEngine.generate(rooms);
    console.log(`[SEWAGE] ${schema.floors.length} qavat, ${schema.totalFixtures} jihoz, ${schema.totalRisers} stoyak`);
    return res.json({ schema });
  } catch (err) {
    console.error('[SEWAGE] Error:', err);
    res.status(500).json({ error: 'Kanalizatsiya sxemasini yaratishda xatolik', message: (err as Error).message });
  }
});

// ── Ливнёвка (yomg'ir suvi kanalizatsiyasi) ──────────────────────────────────
app.post('/api/generate-storm-drain', async (req, res) => {
  try {
    const { description } = req.body;
    console.log('[STORM-DRAIN] description:', (description || '').slice(0, 80));
    const rooms  = parseStormRooms(description || '');
    const schema = stormDrainEngine.generate(rooms);
    console.log(`[STORM-DRAIN] ${schema.floors.length} qavat, ${schema.totalTraps} trap, ${schema.totalFlowLps} l/s`);
    return res.json({ schema });
  } catch (err) {
    console.error('[STORM-DRAIN] Error:', err);
    res.status(500).json({ error: 'Ливнёвка sxemasini yaratishda xatolik', message: (err as Error).message });
  }
});

// ── Qozonxona (Котельная) ────────────────────────────────────────────────────
app.post('/api/generate-boiler-room', async (req, res) => {
  try {
    const { description } = req.body;
    console.log('[BOILER-ROOM] description:', (description || '').slice(0, 80));

    // Parse from description
    const floorsMatch = description?.match(/(\d+)\s*(?:qavat|этаж|floor)/i);
    const areaMatch   = description?.match(/(\d+(?:[.,]\d+)?)\s*m[²2]?/i);
    const floors      = floorsMatch ? parseInt(floorsMatch[1]) : 3;
    const totalAreaM2 = areaMatch   ? parseFloat(areaMatch[1].replace(',', '.')) : floors * 120;
    const hasWarmFloor = /issiq pol|теплый пол|warm.?floor/i.test(description || '');
    const hasWarmWall  = /issiq devor|теплые стены|warm.?wall/i.test(description || '');
    const hasHvs       = !/no.?hvs|без.?гвс/i.test(description || '');

    const schema = boilerRoomEngine.generate({ floors, totalAreaM2, hasWarmFloor, hasWarmWall, hasHvs });
    console.log(`[BOILER-ROOM] ${schema.heatPumpCount}x nasosi, ${schema.totalHeatKw} kW, ${schema.equipment.length} jihoz`);
    return res.json({ schema });
  } catch (err) {
    console.error('[BOILER-ROOM] Error:', err);
    res.status(500).json({ error: 'Qozonxona sxemasini yaratishda xatolik', message: (err as Error).message });
  }
});

// ── Mega Builder: Plan Stage chat ────────────────────────────────────────────
app.post('/api/mega/chat', async (req, res) => {
  try {
    const { history = [], message } = req.body;
    if (!message) return res.status(400).json({ error: 'message required' });
    console.log('[MEGA/CHAT] message:', message.slice(0, 60));
    const result = await megaPlanner.chat(history, message);
    return res.json(result);
  } catch (err) {
    console.error('[MEGA/CHAT] Error:', err);
    res.status(500).json({ error: 'Mega chat xatolik', message: (err as Error).message });
  }
});

// ── Mega Builder: Build all disciplines ───────────────────────────────────────
app.post('/api/mega/build', async (req, res) => {
  try {
    const { spec } = req.body;
    if (!spec) return res.status(400).json({ error: 'spec required' });

    console.log(`[MEGA/BUILD] ${spec.disciplines?.length} soha, ${spec.floorCount} qavat`);

    const results: Record<string, unknown> = {};
    const prompts: Record<string, string> = spec.disciplinePrompts ?? {};

    // Barcha disciplinalar parallel build qilinadi
    await Promise.all((spec.disciplines as string[]).map(async (disc) => {
      try {
        const desc = prompts[disc] || `${spec.floorCount} qavatli bino, jami ${spec.totalAreaM2}m². ${spec.buildingDescription}`;
        console.log(`[MEGA/BUILD] ${disc} prompt: "${desc.slice(0, 80)}"`);

        if (disc === 'warm-floor') {
          const { parseWarmFloorRooms, WarmFloorEngine } = await import('./engine/WarmFloorEngine');
          const rooms  = parseWarmFloorRooms(desc);
          results[disc] = new WarmFloorEngine().generate(rooms);
        } else if (disc === 'water-supply') {
          const { parseWaterRooms, WaterSupplyEngine } = await import('./engine/WaterSupplyEngine');
          const rooms  = parseWaterRooms(desc);
          results[disc] = new WaterSupplyEngine().generate(rooms);
        } else if (disc === 'sewage') {
          const { parseSewageRooms, SewageEngine } = await import('./engine/SewageEngine');
          const rooms  = parseSewageRooms(desc);
          results[disc] = new SewageEngine().generate(rooms);
        } else if (disc === 'storm-drain') {
          const { parseStormRooms, StormDrainEngine } = await import('./engine/StormDrainEngine');
          const rooms  = parseStormRooms(desc);
          results[disc] = new StormDrainEngine().generate(rooms);
        } else if (disc === 'boiler-room') {
          const floors      = spec.floorCount ?? 1;
          const totalAreaM2 = spec.totalAreaM2 ?? 200;
          results[disc] = boilerRoomEngine.generate({
            floors, totalAreaM2,
            hasWarmFloor: spec.hasWarmFloor ?? /issiq pol/i.test(desc),
            hasWarmWall:  spec.hasWarmWall  ?? false,
            hasHvs:       spec.hasHvs       ?? !/gvs siz/i.test(desc),
          });
        } else if (disc === 'facade') {
          const facInput = parseFacadeInput(desc);
          results[disc] = facadeEngine.generate(facInput);
        } else if (disc === 'floor-plan') {
          const parsed = await geminiParser.parseDescriptionLocal(desc);
          results[disc] = 'rooms' in parsed
            ? floorPlanEngine.generateFloorPlan(parsed)
            : floorPlanEngine.generateDrawing(parsed);
        } else if (disc === 'architecture') {
          const parsed = await geminiParser.parseDescriptionLocal(desc);
          results[disc] = 'rooms' in parsed
            ? architectureEngine.generateFromFloorPlan(parsed)
            : architectureEngine.generateFromRoom(parsed);
        } else if (disc === 'electrical') {
          const parsed = await geminiParser.parseDescriptionLocal(desc);
          results[disc] = 'rooms' in parsed
            ? electricalEngine.generateFromFloorPlan(parsed)
            : electricalEngine.generateFromRoom(parsed);
        } else if (disc === 'plumbing') {
          results[disc] = plumbingEngine.generate(desc);
        } else if (disc === 'decor') {
          const parsed = await geminiParser.parseDescriptionLocal(desc);
          results[disc] = 'rooms' in parsed
            ? decorEngine.generate(desc)
            : decorEngine.generate(desc);
        }
      } catch (e) {
        console.error(`[MEGA/BUILD] ${disc} xatolik:`, (e as Error).message);
        results[disc] = null;
      }
    }));

    return res.json({ results });
  } catch (err) {
    console.error('[MEGA/BUILD] Error:', err);
    res.status(500).json({ error: 'Mega build xatolik', message: (err as Error).message });
  }
});

// ── Mega Builder: Edit request ────────────────────────────────────────────────
app.post('/api/mega/edit', async (req, res) => {
  try {
    const { editHistory = [], message, spec } = req.body;
    if (!message || !spec) return res.status(400).json({ error: 'message and spec required' });
    console.log('[MEGA/EDIT] message:', message.slice(0, 60));
    const result = await megaPlanner.classifyEdit(editHistory, message, spec);
    return res.json(result);
  } catch (err) {
    console.error('[MEGA/EDIT] Error:', err);
    res.status(500).json({ error: 'Mega edit xatolik', message: (err as Error).message });
  }
});

// ── Mega Builder: Save project ────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

app.post('/api/mega/save', async (req, res) => {
  try {
    const { userId, name, spec, generations, chatHistory, editHistory } = req.body;
    if (!spec) return res.status(400).json({ error: 'spec required' });

    // JWT token dan user ID olish (auth bypass uchun)
    const authHeader = req.headers.authorization;
    let resolvedUserId = userId;

    if (!UUID_RE.test(resolvedUserId ?? '')) {
      // userId invalid UUID — JWT dan olishga urinish
      if (authHeader) {
        try {
          const { createClient } = await import('@supabase/supabase-js');
          const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
          const { data } = await sb.auth.getUser(authHeader.replace('Bearer ', ''));
          resolvedUserId = data.user?.id;
        } catch { /* ignore */ }
      }
    }

    if (!resolvedUserId || !UUID_RE.test(resolvedUserId)) {
      return res.status(401).json({ error: 'Foydalanuvchi autentifikatsiya qilinmagan. Iltimos, tizimga kiring.' });
    }

    const megaData = {
      project_type: 'mega' as const,
      spec, generations, chatHistory, editHistory,
      savedAt: new Date().toISOString(),
    };
    const project = await saveMegaProject(
      resolvedUserId,
      name || `Mega loyiha — ${spec.floorCount}q ${spec.totalAreaM2}m²`,
      megaData, authHeader
    );
    console.log('[MEGA/SAVE] saved:', project.id, 'user:', resolvedUserId);
    return res.json(project);
  } catch (err) {
    console.error('[MEGA/SAVE] Error:', err);
    res.status(500).json({ error: 'Mega loyihani saqlashda xatolik', message: (err as Error).message });
  }
});

// ── Mega Builder: Update saved project ───────────────────────────────────────
app.patch('/api/mega/project/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { spec, generations, chatHistory, editHistory } = req.body;
    const authHeader = req.headers.authorization;
    const megaData = {
      project_type: 'mega' as const,
      spec, generations, chatHistory, editHistory,
      savedAt: new Date().toISOString(),
    };
    const project = await updateMegaProject(id, megaData, authHeader);
    console.log('[MEGA/UPDATE] updated:', id);
    return res.json(project);
  } catch (err) {
    console.error('[MEGA/UPDATE] Error:', err);
    res.status(500).json({ error: 'Mega loyihani yangilashda xatolik', message: (err as Error).message });
  }
});

// ── Mega Builder: Per-discipline AI edit + rebuild ───────────────────────────
app.post('/api/mega/discipline-edit', async (req, res) => {
  try {
    const { discipline, message, spec, editHistory = [] } = req.body;
    if (!discipline || !message || !spec) {
      return res.status(400).json({ error: 'discipline, message, spec required' });
    }
    console.log(`[MEGA/DISC-EDIT] ${discipline}: ${message.slice(0, 60)}`);

    // 1. AI dan yangi prompt olish
    const result = await megaPlanner.classifyEdit(editHistory, message, spec);

    // 2. Prompt yangilangan bo'lsa rebuild
    const updatedSpec = result.specPatch
      ? { ...spec, ...result.specPatch,
          disciplinePrompts: { ...spec.disciplinePrompts, ...(result.specPatch.disciplinePrompts ?? {}) }
        }
      : spec;

    const prompts = updatedSpec.disciplinePrompts ?? {};
    const desc = prompts[discipline] || `${spec.floorCount} qavatli bino, ${spec.totalAreaM2}m². ${spec.buildingDescription}`;

    let schema: unknown = null;
    try {
      if (discipline === 'warm-floor') {
        const { parseWarmFloorRooms, WarmFloorEngine } = await import('./engine/WarmFloorEngine');
        schema = new WarmFloorEngine().generate(parseWarmFloorRooms(desc));
      } else if (discipline === 'water-supply') {
        const { parseWaterRooms, WaterSupplyEngine } = await import('./engine/WaterSupplyEngine');
        schema = new WaterSupplyEngine().generate(parseWaterRooms(desc));
      } else if (discipline === 'sewage') {
        const { parseSewageRooms, SewageEngine } = await import('./engine/SewageEngine');
        schema = new SewageEngine().generate(parseSewageRooms(desc));
      } else if (discipline === 'storm-drain') {
        const { parseStormRooms, StormDrainEngine } = await import('./engine/StormDrainEngine');
        schema = new StormDrainEngine().generate(parseStormRooms(desc));
      } else if (discipline === 'boiler-room') {
        schema = boilerRoomEngine.generate({
          floors: spec.floorCount ?? 1, totalAreaM2: spec.totalAreaM2 ?? 200,
          hasWarmFloor: spec.hasWarmFloor ?? false, hasWarmWall: spec.hasWarmWall ?? false,
          hasHvs: spec.hasHvs ?? true,
        });
      } else if (discipline === 'facade') {
        schema = facadeEngine.generate(parseFacadeInput(desc));
      } else if (discipline === 'floor-plan') {
        const parsed = await geminiParser.parseDescriptionLocal(desc);
        schema = 'rooms' in parsed ? floorPlanEngine.generateFloorPlan(parsed) : floorPlanEngine.generateDrawing(parsed);
      } else if (discipline === 'architecture') {
        const parsed = await geminiParser.parseDescriptionLocal(desc);
        schema = 'rooms' in parsed ? architectureEngine.generateFromFloorPlan(parsed) : architectureEngine.generateFromRoom(parsed);
      } else if (discipline === 'electrical') {
        const parsed = await geminiParser.parseDescriptionLocal(desc);
        schema = 'rooms' in parsed ? electricalEngine.generateFromFloorPlan(parsed) : electricalEngine.generateFromRoom(parsed);
      } else if (discipline === 'plumbing') {
        schema = plumbingEngine.generate(desc);
      } else if (discipline === 'decor') {
        const parsed = await geminiParser.parseDescriptionLocal(desc);
        schema = 'rooms' in parsed ? decorEngine.generate(desc) : decorEngine.generate(desc);
      }
    } catch (rebuildErr) {
      console.error(`[MEGA/DISC-EDIT] rebuild xatolik:`, (rebuildErr as Error).message);
    }

    return res.json({ reply: result.reply, schema, updatedSpec });
  } catch (err) {
    console.error('[MEGA/DISC-EDIT] Error:', err);
    res.status(500).json({ error: 'Mega disc edit xatolik', message: (err as Error).message });
  }
});

// ── Multi-floor Building generation ──────────────────────────────────────────
app.post('/api/generate-building', async (req, res) => {
  try {
    const { description } = req.body;
    if (!description) return res.status(400).json({ error: 'Description required' });

    console.log('[BUILDING] Parsing:', description.slice(0, 80));

    // Parse → Building
    const building = await geminiParser.parseBuilding(description);
    console.log(`[BUILDING] ${building.floors.length} qavat, jami xonalar:`,
      building.floors.reduce((s, f) => s + f.rooms.length, 0));

    // Generate DrawingData per floor
    const floorDrawings = floorPlanEngine.generateBuilding(building);

    return res.json({
      building,
      floorDrawings,           // DrawingData[] — biri har qavat uchun
      floorCount: building.floors.length,
      footprint:  building.footprint,
    });
  } catch (err) {
    console.error('[BUILDING] Error:', err);
    res.status(500).json({
      error: 'Failed to generate building',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
});

app.post('/api/export/dxf', async (req, res) => {
  try {
    const { drawingData } = req.body;

    if (!drawingData) {
      return res.status(400).json({ error: 'Drawing data is required' });
    }

    const dxf = exportToDxf(drawingData);

    res.setHeader('Content-Type', 'application/dxf');
    res.setHeader('Content-Disposition', `attachment; filename="floorplan-${drawingData.id}.dxf"`);
    res.send(dxf);
  } catch (error) {
    console.error('DXF export error:', error);
    res.status(500).json({ 
      error: 'Failed to export DXF',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/export/pdf', async (req, res) => {
  try {
    const { drawingData } = req.body;

    if (!drawingData) {
      return res.status(400).json({ error: 'Drawing data is required' });
    }

    const pdf = await pdfExporter.exportAsync(drawingData);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="floorplan-${drawingData.id}.pdf"`);
    res.send(pdf);
  } catch (error) {
    console.error('PDF export error:', error);
    res.status(500).json({ 
      error: 'Failed to export PDF',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/projects', async (req, res) => {
  try {
    const { userId, name, description, drawingData } = req.body;
    const authHeader = req.headers.authorization;

    if (!userId || !name || !drawingData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const project = await saveProject(userId, name, description, drawingData, authHeader);
    res.json(project);
  } catch (error) {
    console.error('Save project error:', error);
    res.status(500).json({ 
      error: 'Failed to save project',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/projects/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const authHeader = req.headers.authorization;
    const projects = await getProjectHistory(userId, authHeader);
    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ 
      error: 'Failed to get projects',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/project/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    const project = await getProject(id, authHeader);
    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ 
      error: 'Failed to get project',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Rename project
app.patch('/api/project/:id/rename', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const authHeader = req.headers.authorization;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    const project = await renameProject(id, name.trim(), authHeader);
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to rename', message: error instanceof Error ? error.message : 'Unknown' });
  }
});

// Soft delete → trash
app.delete('/api/project/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    await softDeleteProject(id, authHeader);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete', message: error instanceof Error ? error.message : 'Unknown' });
  }
});

// Get trash
app.get('/api/trash/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const authHeader = req.headers.authorization;
    const items = await getTrash(userId, authHeader);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get trash', message: error instanceof Error ? error.message : 'Unknown' });
  }
});

// Restore from trash
app.patch('/api/project/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    const project = await restoreProject(id, authHeader);
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: 'Failed to restore', message: error instanceof Error ? error.message : 'Unknown' });
  }
});

// Hard delete (permanent)
app.delete('/api/project/:id/permanent', async (req, res) => {
  try {
    const { id } = req.params;
    const authHeader = req.headers.authorization;
    await hardDeleteProject(id, authHeader);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to permanently delete', message: error instanceof Error ? error.message : 'Unknown' });
  }
});

// Update project drawing (edit/regenerate with conversation history)
app.patch('/api/project/:id/drawing', async (req, res) => {
  try {
    const { id } = req.params;
    const { userMessage, history, currentDrawingData } = req.body;
    const authHeader = req.headers.authorization;

    if (!userMessage) return res.status(400).json({ error: 'userMessage is required' });

    // 1. Build enriched message that includes current state context
    let enrichedMessage = userMessage;
    if (currentDrawingData && currentDrawingData.fixtures?.length > 0) {
      const existingFixtures = currentDrawingData.fixtures.map((f: { type: string; wall: string }) => `${f.type} (${f.wall})`).join(', ');
      const wallCount = currentDrawingData.walls?.length ?? 4;
      // Tell AI what already exists so it preserves it
      enrichedMessage = `Xonada hozir bor: ${existingFixtures}. Devorlar: ${wallCount}. Foydalanuvchi so'rovi: ${userMessage}. MUHIM: Mavjud narsalarni saqla, faqat so'ralgan o'zgarishni qil.`;
    }

    // 2. Parse with conversation history (enriched message)
    const parsed = await geminiParser.parseWithHistory(enrichedMessage, history || []);

    // 3. Generate drawing
    let drawingData;
    if ('rooms' in parsed) {
      drawingData = floorPlanEngine.generateFloorPlan(parsed);
    } else {
      drawingData = floorPlanEngine.generateDrawing(parsed);
    }

    // 4. Merge: if current drawing exists and new drawing has fewer fixtures, keep old ones
    if (currentDrawingData && currentDrawingData.fixtures?.length > 0 && drawingData.fixtures.length < currentDrawingData.fixtures.length) {
      // AI removed fixtures — check if user explicitly asked to remove
      const removeKeywords = ['o\'chir', 'olib tashla', 'yo\'q qil', 'remove', 'delete', 'o\'rniga'];
      const userWantsRemoval = removeKeywords.some(kw => userMessage.toLowerCase().includes(kw));
      if (!userWantsRemoval) {
        // Preserve existing fixtures, add new ones from AI response
        const existingTypes = new Set(currentDrawingData.fixtures.map((f: { type: string }) => f.type));
        const newFixtures = drawingData.fixtures.filter((f: { type: string }) => !existingTypes.has(f.type));
        drawingData = {
          ...drawingData,
          fixtures: [...currentDrawingData.fixtures, ...newFixtures],
          walls: currentDrawingData.walls, // keep original walls
          pipes: drawingData.pipes,
          doors: currentDrawingData.doors ?? drawingData.doors,
          windows: currentDrawingData.windows ?? drawingData.windows,
        };
      }
    }

    // 5. Build updated messages
    const assistantContext = JSON.stringify({
      type: 'rooms' in parsed ? 'floorplan' : 'room',
      fixtures: drawingData.fixtures.map((f: { type: string; wall: string }) => ({ type: f.type, wall: f.wall })),
      walls: drawingData.walls.length,
      doors: drawingData.doors?.length ?? 0,
    });

    const updatedMessages = [
      ...(history || []),
      { role: 'user', content: userMessage },
      { role: 'assistant', content: assistantContext }
    ];

    // 6. Save to DB
    const project = await updateProjectDrawing(id, drawingData, updatedMessages, authHeader);
    res.json({ ...project, drawingData });
  } catch (error) {
    console.error('Update drawing error:', error);
    res.status(500).json({ error: 'Failed to update drawing', message: error instanceof Error ? error.message : 'Unknown' });
  }
});

// Interior design / decor generation
app.post('/api/generate-decor', (req, res) => {
  try {
    const { description } = req.body;
    if (!description) return res.status(400).json({ error: 'description required' });
    const decorSchema = decorEngine.generate(description);
    return res.json({ decorSchema });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate decor', message: error instanceof Error ? error.message : 'Unknown' });
  }
});

// Direct architecture generation (no Gemini — accepts roomSpec or floorPlan directly)
app.post('/api/generate-architecture', (req, res) => {
  try {
    const { roomSpec, floorPlan } = req.body;
    if (floorPlan) return res.json({ archData: architectureEngine.generateFromFloorPlan(floorPlan) });
    if (roomSpec)  return res.json({ archData: architectureEngine.generateFromRoom(roomSpec) });
    return res.status(400).json({ error: 'roomSpec or floorPlan required' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate architecture drawing', message: error instanceof Error ? error.message : 'Unknown' });
  }
});

// Direct electrical generation (no Gemini — accepts roomSpec or floorPlan directly)
app.post('/api/generate-electrical', (req, res) => {
  try {
    const { roomSpec, floorPlan } = req.body;
    if (floorPlan) {
      return res.json({ electricalData: electricalEngine.generateFromFloorPlan(floorPlan) });
    }
    if (roomSpec) {
      return res.json({ electricalData: electricalEngine.generateFromRoom(roomSpec) });
    }
    return res.status(400).json({ error: 'roomSpec or floorPlan required' });
  } catch (error) {
    console.error('Electrical generation error:', error);
    res.status(500).json({ error: 'Failed to generate electrical drawing', message: error instanceof Error ? error.message : 'Unknown' });
  }
});

// ── Facade generation ─────────────────────────────────────────────────────────
app.post('/api/generate-facade', async (req, res) => {
  try {
    const { description } = req.body;
    if (!description) return res.status(400).json({ error: 'description required' });

    console.log('[FACADE] Parsing:', description.slice(0, 80));
    const input  = parseFacadeInput(description);
    const schema = facadeEngine.generate(input);
    console.log(`[FACADE] ${schema.style} uslub, ${schema.floorCount} qavat, ${schema.elevations.length} fasad`);
    return res.json({ schema });
  } catch (err) {
    console.error('[FACADE] Error:', err);
    res.status(500).json({ error: 'Fasad generatsiya xatolik', message: (err as Error).message });
  }
});

// SPA fallback — serve index.html for all non-API routes in production
if (process.env.NODE_ENV === 'production') {
  const clientDist = join(process.cwd(), 'client', 'dist');
  app.get('*', (_req, res) => {
    res.sendFile(join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

