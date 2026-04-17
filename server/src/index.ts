import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { join } from 'path';
import { GeminiParser } from './ai/GeminiParser';
import { FloorPlanEngine } from './engine/FloorPlanEngine';
import { PlumbingEngine } from './engine/PlumbingEngine';
import { exportToDxf } from './export/DxfExporter';
import { PdfExporter } from './export/PdfExporter';
import { saveProject, getProjectHistory, getProject, renameProject, softDeleteProject, restoreProject, hardDeleteProject, getTrash, updateProjectDrawing } from './db/supabase';

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

const geminiParser = new GeminiParser(
  process.env.GEMINI_API_KEY || '',
  process.env.GROQ_API_KEY || ''
);
const floorPlanEngine = new FloorPlanEngine();
const plumbingEngine = new PlumbingEngine();
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
