# FloorPlan Generator

Full-stack TypeScript application for generating floor plans using AI.

## Structure
- `/client` - React + Vite + TailwindCSS frontend
- `/server` - Express + TypeScript backend
- `/shared` - Shared TypeScript types

## Features
- 🤖 AI-powered floor plan generation (Gemini)
- 🎨 2D Canvas visualization (Konva.js)
- 📥 Export to DXF and PDF formats
- 💾 Project history with Supabase
- 🔐 Authentication (Supabase Auth)
- 📱 Mobile responsive design
- 🌐 Uzbek language interface

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:

### Server (.env)
```bash
cp server/.env.example server/.env
```
Edit `server/.env`:
```
PORT=5000
GEMINI_API_KEY=your_gemini_api_key_here
SUPABASE_URL=your_supabase_url_here
SUPABASE_SERVICE_KEY=your_supabase_service_key_here
```

### Client (.env)
```bash
cp client/.env.example client/.env
```
Edit `client/.env`:
```
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

3. Setup Supabase database:
Run the SQL from `DEPLOYMENT.md` in your Supabase SQL Editor

4. Run development servers:
```bash
npm run dev
```

This will start:
- Client: http://localhost:3000
- Server: http://localhost:5000

## Demo Mode

The app works in demo mode without Gemini API key:
- Generator will use mock data
- All other features work normally

## Tech Stack
- Frontend: React 18, Vite, TailwindCSS, Konva.js
- Backend: Express, TypeScript
- Auth & Database: Supabase
- AI: Google Gemini
- Types: Shared TypeScript definitions

## Testing

Run tests:
```bash
cd server
npm test
```

All 33 tests should pass ✓

## Deployment

See `DEPLOYMENT.md` for Railway and Render deployment instructions.
