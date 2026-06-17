import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import Layout from './components/layout/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Chat from './pages/Chat';
import Kanban from './pages/Kanban';
import Loading from './components/common/Loading';
import Toast from './components/common/Toast';
import { Bell, FileText, Ticket, Users } from 'lucide-react';

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

const Placeholder = ({ title, description, icon: Icon }) => (
  <section className="empty-state">
    <div className="empty-state__icon">
      <Icon size={28} strokeWidth={1.8} />
    </div>
    <h2>{title}</h2>
    <p>{description}</p>
  </section>
);

const ProtectedApp = () => (
  <WebSocketProvider>
    <Layout>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/chat" element={<Chat />} />
        <Route
          path="/tickets"
          element={<Placeholder title="Tickets" description="Fila de atendimento pronta para a proxima etapa." icon={Ticket} />}
        />
        <Route path="/tasks" element={<Kanban />} />
        <Route path="/kanban" element={<Kanban />} />
        <Route
          path="/files"
          element={<Placeholder title="Arquivos" description="Central para anexos e documentos do time." icon={FileText} />}
        />
        <Route
          path="/users"
          element={<Placeholder title="Usuarios" description="Gestao de perfis e permissoes." icon={Users} />}
        />
        <Route
          path="/notifications"
          element={<Placeholder title="Notificacoes" description="Eventos importantes do workspace." icon={Bell} />}
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  </WebSocketProvider>
);

function App() {
  return (
    <AuthProvider>
      <Router>
        <Toast />
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
