import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { AuthProvider, ProtectedRoute } from './lib/auth';
import { CreditsProvider } from './lib/credits';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Project from './pages/Project';
import Generator from './pages/Generator';
import Preview from './pages/Preview';
import DrawingSelect from './pages/DrawingSelect';
import Pricing from './pages/Pricing';

// Lazy load heavy pages — code splitting
const SuperGenerator    = lazy(() => import('./pages/SuperGenerator'));
const MegaBuilder       = lazy(() => import('./pages/MegaBuilder'));
const MegaProjectDetail = lazy(() => import('./pages/MegaProjectDetail'));

function PageLoader() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true
      }}
    >
      <AuthProvider>
        <CreditsProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />
          <Route path="/project/:id" element={
            <ProtectedRoute><Project /></ProtectedRoute>
          } />
          <Route path="/generator" element={
            <ProtectedRoute><Generator /></ProtectedRoute>
          } />
          <Route path="/preview" element={<Preview />} />
          <Route path="/pricing" element={<Pricing />} />
          {/* Yangi drawing tanlash + Super Generator */}
          <Route path="/select" element={
            <ProtectedRoute><DrawingSelect /></ProtectedRoute>
          } />
          <Route path="/super/:type" element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}><SuperGenerator /></Suspense>
            </ProtectedRoute>
          } />
          <Route path="/mega" element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}><MegaBuilder /></Suspense>
            </ProtectedRoute>
          } />
          <Route path="/mega/:id" element={
            <ProtectedRoute>
              <Suspense fallback={<PageLoader />}><MegaProjectDetail /></Suspense>
            </ProtectedRoute>
          } />
        </Routes>
        </CreditsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
