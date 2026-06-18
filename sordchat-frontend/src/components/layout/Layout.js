import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Bot,
  BriefcaseBusiness,
  Cake,
  ChevronLeft,
  ChevronRight,
  Files,
  LayoutDashboard,
  ListTodo,
  LogOut,
  MessageSquare,
  ShieldCheck,
  Ticket,
  Users,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useWebSocket } from '../../contexts/WebSocketContext';
import BrandLogo from '../common/BrandLogo';
import { isBirthdayToday } from '../../utils/birthdays';

const pageMeta = {
  '/dashboard': ['Dashboard', 'Visao geral operacional do SorDChat'],
  '/chat': ['Chat', 'Conversas em tempo real'],
  '/tickets': ['Tickets', 'Fila de suporte e atendimento'],
  '/tasks': ['Tasks', 'Quadro de execucao do time'],
  '/kanban': ['Tasks', 'Quadro de execucao do time'],
  '/files': ['Arquivos', 'Documentos e anexos compartilhados'],
  '/users': ['Usuarios', 'Equipe e permissoes'],
  '/birthdays': ['Aniversarios', 'Ultimos e proximos aniversariantes'],
  '/assistant': ['Assistente', 'Crie tickets e tarefas com linguagem natural'],
  '/admin': ['Admin', 'Gestao global do workspace'],
  '/coordinator': ['Coordenacao', 'Gestao do setor coordenado'],
  '/notifications': ['Notificacoes', 'Eventos recentes do workspace'],
};

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, logout, isAdmin, isCoordinator } = useAuth();
  const { connected, onlineUsers } = useWebSocket();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', show: true },
    { name: 'Chat', icon: MessageSquare, path: '/chat', show: true },
    { name: 'Tickets', icon: Ticket, path: '/tickets', show: true },
    { name: 'Tasks', icon: ListTodo, path: '/tasks', show: true },
    { name: 'Arquivos', icon: Files, path: '/files', show: true },
    { name: 'Usuarios', icon: Users, path: '/users', show: isCoordinator() },
    { name: 'Aniversarios', icon: Cake, path: '/birthdays', show: true },
    { name: 'Assistente', icon: Bot, path: '/assistant', show: true },
    { name: 'Admin', icon: ShieldCheck, path: '/admin', show: isAdmin() },
    { name: 'Coordenacao', icon: BriefcaseBusiness, path: '/coordinator', show: isCoordinator() },
    { name: 'Alertas', icon: Bell, path: '/notifications', show: true },
  ];

  const [title, description] = pageMeta[location.pathname] || ['SorDChat', 'Sistema corporativo de comunicacao'];
  const userBirthdayToday = isBirthdayToday(user?.birthday);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? '' : 'sidebar--collapsed'}`}>
        <div className="sidebar__brand">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <BrandLogo showText={false} />
              {sidebarOpen && (
                <div className="min-w-0">
                  <p className="m-0 truncate text-base font-extrabold text-white">SorDChat</p>
                  <p className="m-0 truncate text-xs text-slate-400">Workspace interno</p>
                </div>
              )}
            </div>
            <button
              className="icon-button sidebar__collapse"
              onClick={() => setSidebarOpen((value) => !value)}
              aria-label={sidebarOpen ? 'Recolher menu' : 'Expandir menu'}
              title={sidebarOpen ? 'Recolher menu' : 'Expandir menu'}
            >
              {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
          </div>
        </div>

        <nav className="nav-list" aria-label="Navegacao principal">
          {menuItems
            .filter((item) => item.show)
            .map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path || (item.path === '/tasks' && location.pathname === '/kanban');

              return (
                <button
                  key={item.path}
                  className={`nav-item ${active ? 'nav-item--active' : ''}`}
                  onClick={() => navigate(item.path)}
                  title={item.name}
                >
                  <Icon size={19} strokeWidth={1.9} />
                  {sidebarOpen && <span className="truncate font-semibold">{item.name}</span>}
                  {sidebarOpen && item.path === '/chat' && (
                    <span className={`status-dot ml-auto ${connected ? 'status-dot--online' : ''}`} />
                  )}
                </button>
              );
            })}
        </nav>

        <div className="sidebar__profile mt-auto">
          <div className="mb-4 flex items-center gap-3">
            <div className={`sidebar__avatar grid h-10 w-10 place-items-center rounded-lg bg-slate-700 text-sm font-bold text-white ${userBirthdayToday ? 'sidebar__avatar--birthday' : ''}`}>
              {(user?.full_name || user?.username || 'U').charAt(0).toUpperCase()}
              <span className={`sidebar__avatar-status ${connected ? 'status-dot--online' : ''}`} />
              {userBirthdayToday && (
                <>
                  <span className="party-hat" />
                  <span className="avatar-confetti avatar-confetti--one" />
                  <span className="avatar-confetti avatar-confetti--two" />
                  <span className="avatar-confetti avatar-confetti--three" />
                </>
              )}
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <p className="m-0 truncate text-sm font-bold text-white">{user?.full_name || user?.username}</p>
                <p className="m-0 truncate text-xs text-slate-400">
                  {connected ? `${onlineUsers.length + 1} online` : 'Desconectado'}
                </p>
              </div>
            )}
            {sidebarOpen && <ChevronRight className="ml-auto text-slate-400" size={16} />}
          </div>
          <button className="nav-item text-red-200 hover:text-white" onClick={handleLogout} title="Sair">
            <LogOut size={18} />
            {sidebarOpen && <span className="font-semibold">Sair</span>}
          </button>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="min-w-0">
            <h1 className="m-0 text-2xl font-extrabold text-slate-950">{title}</h1>
            <p className="m-0 mt-1 text-sm text-slate-500">{description}</p>
          </div>

          <div className="flex items-center gap-3">
            <span className={`badge ${connected ? 'badge--success' : 'badge--danger'}`}>
              <span className={`status-dot ${connected ? 'status-dot--online' : ''}`} />
              {connected ? 'Online' : 'Offline'}
            </span>
            <button
              className="icon-button icon-button--light"
              onClick={() => navigate('/notifications')}
              aria-label="Notificacoes"
              title="Notificacoes"
            >
              <Bell size={18} />
            </button>
          </div>
        </header>

        <main className="page-content">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
