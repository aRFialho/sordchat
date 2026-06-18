import React, { useEffect, useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  CheckCircle2,
  MessageSquareText,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Ticket,
  UserPlus,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../config';

const initialUser = {
  username: '',
  email: '',
  full_name: '',
  password: '',
  access_level: 'usuario',
  department: 'TI',
  role_title: '',
  phone_extension: '',
  birthday: '',
};

const levelLabel = {
  master: 'Admin',
  coordenador: 'Coordenador',
  usuario: 'Usuario',
};

const requestJson = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`,
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Operacao nao concluida.');
  }
  return response.json();
};

const AdminPanel = () => {
  const [overview, setOverview] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [newUser, setNewUser] = useState(initialUser);
  const [newGroup, setNewGroup] = useState({ name: '', description: '', department: 'TI' });

  const loadData = async () => {
    setLoading(true);
    try {
      const [overviewData, departmentData, groupData] = await Promise.all([
        requestJson('/admin/overview'),
        requestJson('/departments/'),
        requestJson('/groups/'),
      ]);
      setOverview(overviewData);
      setDepartments(departmentData);
      setGroups(groupData);
      setNewUser((prev) => ({ ...prev, department: departmentData[0] || prev.department }));
      setNewGroup((prev) => ({ ...prev, department: departmentData[0] || prev.department }));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    const users = overview?.users || [];
    if (!term) return users;
    return users.filter((user) =>
      [user.full_name, user.username, user.email, user.department, user.role_title, user.access_level]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [overview, query]);

  const handleCreateUser = async (event) => {
    event.preventDefault();
    try {
      await requestJson('/users/', {
        method: 'POST',
        body: JSON.stringify(newUser),
      });
      toast.success('Usuario criado.');
      setNewUser({ ...initialUser, department: departments[0] || 'TI' });
      await loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const updateTicket = async (ticketId, status) => {
    try {
      await requestJson(`/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      toast.success('Ticket atualizado.');
      await loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleCreateGroup = async (event) => {
    event.preventDefault();
    try {
      await requestJson('/groups/', {
        method: 'POST',
        body: JSON.stringify(newGroup),
      });
      toast.success('Grupo criado.');
      setNewGroup({ name: '', description: '', department: departments[0] || 'TI' });
      await loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const stats = overview?.stats || {};

  return (
    <div className="work-page">
      <section className="panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="badge">
              <ShieldCheck size={13} />
              Administrador
            </span>
            <h2 className="m-0 mt-3 text-2xl font-extrabold text-slate-950">Painel administrativo</h2>
            <p className="m-0 mt-1 text-sm text-slate-500">
              Gerencie usuarios, setores, tickets e acompanhe conversas recentes do workspace.
            </p>
          </div>
          <button className="button-secondary" type="button" onClick={loadData} disabled={loading}>
            <RefreshCw size={17} />
            Atualizar
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          ['Usuarios', stats.users || 0, Users],
          ['Ativos', stats.active_users || 0, CheckCircle2],
          ['Tickets', stats.tickets || 0, Ticket],
          ['Abertos', stats.open_tickets || 0, BriefcaseBusiness],
          ['Mensagens', stats.messages || 0, MessageSquareText],
        ].map(([label, value, Icon]) => (
          <article className="metric-card" key={label}>
            <Icon className="text-teal-700" size={20} />
            <p className="m-0 mt-4 text-sm font-bold text-slate-500">{label}</p>
            <p className="m-0 mt-2 text-3xl font-extrabold text-slate-950">{value}</p>
          </article>
        ))}
      </section>

      <section className="panel p-5">
        <div className="mb-4 flex items-center gap-2">
          <UserPlus size={18} className="text-teal-700" />
          <h3 className="m-0 text-lg font-extrabold text-slate-950">Criar usuario</h3>
        </div>
        <form className="admin-form" onSubmit={handleCreateUser}>
          <input className="input" value={newUser.full_name} onChange={(event) => setNewUser((prev) => ({ ...prev, full_name: event.target.value }))} placeholder="Nome completo" />
          <input className="input" value={newUser.username} onChange={(event) => setNewUser((prev) => ({ ...prev, username: event.target.value }))} placeholder="Usuario" />
          <input className="input" value={newUser.email} onChange={(event) => setNewUser((prev) => ({ ...prev, email: event.target.value }))} placeholder="Email" />
          <input className="input" type="password" value={newUser.password} onChange={(event) => setNewUser((prev) => ({ ...prev, password: event.target.value }))} placeholder="Senha inicial" />
          <select className="select" value={newUser.access_level} onChange={(event) => setNewUser((prev) => ({ ...prev, access_level: event.target.value }))}>
            <option value="usuario">Usuario</option>
            <option value="coordenador">Coordenador</option>
            <option value="master">Administrador</option>
          </select>
          <select className="select" value={newUser.department} onChange={(event) => setNewUser((prev) => ({ ...prev, department: event.target.value }))}>
            {departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
          <input className="input" value={newUser.role_title} onChange={(event) => setNewUser((prev) => ({ ...prev, role_title: event.target.value }))} placeholder="Cargo" />
          <input className="input" value={newUser.phone_extension} onChange={(event) => setNewUser((prev) => ({ ...prev, phone_extension: event.target.value }))} placeholder="Ramal" />
          <input className="input" value={newUser.birthday} onChange={(event) => setNewUser((prev) => ({ ...prev, birthday: event.target.value }))} placeholder="Aniversario MM-DD" />
          <button className="button-primary" type="submit">
            <Save size={17} />
            Salvar usuario
          </button>
        </form>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="panel p-5">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h3 className="m-0 text-lg font-extrabold text-slate-950">Usuarios por setor</h3>
            <div className="relative w-full md:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
              <input className="input pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar usuario" />
            </div>
          </div>
          <div className="grid gap-3">
            {filteredUsers.map((user) => (
              <div className="rounded-lg border border-slate-200 bg-white p-3" key={user.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="m-0 font-extrabold text-slate-950">{user.full_name}</p>
                    <p className="m-0 text-sm text-slate-500">@{user.username} - {user.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="badge">{levelLabel[user.access_level] || user.access_level}</span>
                    <span className="badge">{user.department || 'Sem setor'}</span>
                    {user.phone_extension && <span className="badge">Ramal {user.phone_extension}</span>}
                  </div>
                </div>
                <p className="m-0 mt-2 text-sm text-slate-500">
                  {user.role_title || 'Sem cargo definido'} {user.birthday ? `- Aniversario ${user.birthday}` : ''}
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel p-5">
          <h3 className="m-0 text-lg font-extrabold text-slate-950">Setores cadastrados</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {(overview?.departments || departments).map((department) => (
              <span className="badge" key={department}>
                {department}
              </span>
            ))}
          </div>

          <form className="mt-5 grid gap-2" onSubmit={handleCreateGroup}>
            <input
              className="input"
              value={newGroup.name}
              onChange={(event) => setNewGroup((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Novo grupo"
            />
            <input
              className="input"
              value={newGroup.description}
              onChange={(event) => setNewGroup((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Descricao do grupo"
            />
            <select
              className="select"
              value={newGroup.department}
              onChange={(event) => setNewGroup((prev) => ({ ...prev, department: event.target.value }))}
            >
              {departments.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
            <button className="button-primary" type="submit">
              Criar grupo
            </button>
          </form>

          <div className="mt-5 grid gap-2">
            {groups.map((group) => (
              <div className="rounded-lg border border-slate-200 bg-white p-3" key={group.id}>
                <p className="m-0 font-extrabold text-slate-950">{group.name}</p>
                <p className="m-0 text-sm text-slate-500">{group.department || 'Sem setor'}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="panel p-5">
          <h3 className="m-0 text-lg font-extrabold text-slate-950">Tickets recentes</h3>
          <div className="mt-4 grid gap-3">
            {(overview?.tickets || []).slice(0, 8).map((ticket) => (
              <div className="rounded-lg border border-slate-200 bg-white p-3" key={ticket.id}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="m-0 font-extrabold text-slate-950">{ticket.title}</p>
                  <span className="badge">{ticket.department || 'Sem setor'}</span>
                </div>
                <p className="m-0 mt-1 text-sm text-slate-500">{ticket.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['Aberto', 'Em andamento', 'Resolvido'].map((status) => (
                    <button key={status} className="button-secondary" type="button" disabled={ticket.status === status} onClick={() => updateTicket(ticket.id, status)}>
                      {status}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {(overview?.tickets || []).length === 0 && <p className="m-0 text-sm text-slate-500">Nenhum ticket registrado.</p>}
          </div>
        </article>

        <article className="panel p-5">
          <h3 className="m-0 text-lg font-extrabold text-slate-950">Conversas recentes</h3>
          <div className="mt-4 grid gap-3">
            {(overview?.messages || []).slice(0, 10).map((message) => (
              <div className="rounded-lg border border-slate-200 bg-white p-3" key={message.id}>
                <p className="m-0 text-sm font-bold text-slate-700">
                  {message.sender_name} {message.receiver_name ? `para ${message.receiver_name}` : 'no chat geral'}
                </p>
                <p className="m-0 mt-1 line-clamp-2 text-sm text-slate-500">{message.content}</p>
              </div>
            ))}
            {(overview?.messages || []).length === 0 && <p className="m-0 text-sm text-slate-500">Nenhuma mensagem registrada.</p>}
          </div>
        </article>
      </section>
    </div>
  );
};

export default AdminPanel;
