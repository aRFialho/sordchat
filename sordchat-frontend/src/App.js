import React from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import Layout from './components/layout/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Kanban from './pages/Kanban';
import Tickets from './pages/Tickets';
import Files from './pages/Files';
import Users from './pages/Users';
import Birthdays from './pages/Birthdays';
import Notifications from './pages/Notifications';
import AdminPanel from './pages/AdminPanel';
import CoordinatorPanel from './pages/CoordinatorPanel';
import Loading from './components/common/Loading';
import Toast from './components/common/Toast';
import VersionUpdatePrompt from './components/common/VersionUpdatePrompt';
import BirthdayCelebration from './components/common/BirthdayCelebration';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <Loading fullScreen text="Verificando sessao..." />;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <Loading fullScreen text="Verificando sessao..." />;
  }

  return !isAuthenticated ? children : <Navigate to="/dashboard" replace />;
};

const ProtectedApp = () => (
  <WebSocketProvider>
    <Layout>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/tickets" element={<Tickets />} />
        <Route path="/tasks" element={<Kanban />} />
        <Route path="/kanban" element={<Kanban />} />
        <Route path="/files" element={<Files />} />
        <Route path="/users" element={<Users />} />
        <Route path="/birthdays" element={<Birthdays />} />
        <Route path="/assistant" element={<Navigate to="/dashboard" replace />} />
        <Route path="/admin" element={<AdminPanel />} />
        <Route path="/coordinator" element={<CoordinatorPanel />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  </WebSocketProvider>
);

function App() {
  const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

  return (
    <AuthProvider>
      <Router>
        <Toast />
        <VersionUpdatePrompt />
        <BirthdayCelebration />
        <Routes>
          <Route
            path="/"
            element={<Landing />}
          />
          <Route
            path="/login"
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            }
          />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <ProtectedApp />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
