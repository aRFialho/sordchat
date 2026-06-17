import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ListTodo,
  MessageSquare,
  Radio,
  Ticket,
  Users,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';

const Dashboard = () => {
  const { user } = useAuth();
  const { connected, onlineUsers, messages } = useWebSocket();
  const navigate = useNavigate();

  const stats = useMemo(
    () => [
      {
        label: 'Tickets',
        value: 4,
        detail: '3 abertos',
        icon: Ticket,
        tone: 'text-blue-700 bg-blue-50',
      },
      {
        label: 'Tasks',
        value: 8,
        detail: '4 em andamento',
        icon: ListTodo,
        tone: 'text-teal-700 bg-teal-50',
      },
      {
        label: 'Mensagens',
        value: Math.max(messages.length, 25),
        detail: `${messages.filter((msg) => msg.sender_id !== user?.id).length} recebidas na sessao`,
        icon: MessageSquare,
        tone: 'text-violet-700 bg-violet-50',
      },
      {
        label: 'Usuarios',
        value: onlineUsers.length + 1,
        detail: connected ? 'online agora' : 'sem socket',
        icon: Users,
        tone: 'text-amber-700 bg-amber-50',
      },
    ],
    [connected, messages, onlineUsers.length, user?.id]
  );

  const activity = [
    {
      icon: MessageSquare,
      title: 'Chat em tempo real',
      detail: connected ? 'WebSocket conectado e ouvindo novas mensagens.' : 'Aguardando conexao com o backend.',
    },
    {
      icon: ListTodo,
      title: 'Quadro de tarefas',
      detail: 'Modo local habilitado para testar fluxos sem depender de rotas antigas.',
    },
    {
      icon: CheckCircle2,
      title: 'Sessao autenticada',
      detail: `${user?.full_name || user?.username} conectado como ${user?.access_level || 'usuario'}.`,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <span className={`badge ${connected ? 'badge--success' : 'badge--danger'}`}>
              <Radio size={13} />
              {connected ? 'Sistema online' : 'Socket desconectado'}
            </span>
            <h2 className="m-0 mt-4 text-3xl font-extrabold text-slate-950">
              Bem-vindo, {user?.full_name || user?.username}.
            </h2>
            <p className="m-0 mt-2 max-w-2xl text-slate-500">
              Este painel resume a retomada do SorDChat: comunicacao, tarefas e base para atendimento interno.
            </p>
          </div>

          <div className="grid gap-2 text-sm text-slate-500">
            <span className="flex items-center gap-2">
              <Clock3 size={16} />
              {new Date().toLocaleDateString('pt-BR', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <span className="flex items-center gap-2">
              <Activity size={16} />
              Versao de retomada local
            </span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => {
          const Icon = item.icon;
          return (
            <article className="metric-card" key={item.label}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="m-0 text-sm font-bold text-slate-500">{item.label}</p>
                  <p className="m-0 mt-2 text-3xl font-extrabold text-slate-950">{item.value}</p>
                  <p className="m-0 mt-1 text-sm text-slate-500">{item.detail}</p>
                </div>
                <div className={`grid h-11 w-11 place-items-center rounded-lg ${item.tone}`}>
                  <Icon size={21} />
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="panel p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="m-0 text-lg font-extrabold text-slate-950">Atividade recente</h3>
              <p className="m-0 mt-1 text-sm text-slate-500">Sinais principais para continuar o projeto.</p>
            </div>
          </div>

          <div className="grid gap-3">
            {activity.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-white text-teal-700">
                    <Icon size={18} />
                  </div>
                  <div>
                    <p className="m-0 text-sm font-extrabold text-slate-900">{item.title}</p>
                    <p className="m-0 mt-1 text-sm text-slate-500">{item.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="panel p-6">
          <h3 className="m-0 text-lg font-extrabold text-slate-950">Acoes rapidas</h3>
          <p className="m-0 mt-1 text-sm text-slate-500">Fluxos uteis para testar agora.</p>

          <div className="mt-5 grid gap-3">
            <button className="button-secondary justify-between" onClick={() => navigate('/chat')}>
              <span className="flex items-center gap-2">
                <MessageSquare size={18} />
                Abrir chat
              </span>
              <ArrowRight size={17} />
            </button>
            <button className="button-secondary justify-between" onClick={() => navigate('/tasks')}>
              <span className="flex items-center gap-2">
                <ListTodo size={18} />
                Revisar tasks
              </span>
              <ArrowRight size={17} />
            </button>
            <button className="button-secondary justify-between" onClick={() => navigate('/tickets')}>
              <span className="flex items-center gap-2">
                <Ticket size={18} />
                Ver tickets
              </span>
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
