import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GeminiParser } from './ai/GeminiParser';
import { FloorPlanEngine } from './engine/FloorPlanEngine';
import { exportToDxf } from './export/DxfExporter';
import { PdfExporter } from './export/PdfExporter';
import { saveProject, getProjectHistory, getProject } from './db/supabase';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const geminiParser = new GeminiParser(
  process.env.GEMINI_API_KEY || '',
  process.env.GROQ_API_KEY || ''
);
const floorPlanEngine = new FloorPlanEngine();
const pdfExporter = new PdfExporter();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/generate', async (req, res) => {
  try {
    const { description } = req.body;

    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    // Step 1: Parse natural language to RoomSpec or FloorPlan
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

    const pdf = pdfExporter.export(drawingData);

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

    if (!userId || !name || !drawingData) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const project = await saveProject(userId, name, description, drawingData);
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
    const projects = await getProjectHistory(userId);
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
    const project = await getProject(id);
    res.json(project);
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ 
      error: 'Failed to get project',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
