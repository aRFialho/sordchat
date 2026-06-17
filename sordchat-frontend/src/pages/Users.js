import React, { useEffect, useMemo, useState } from 'react';
import { Mail, RefreshCw, Search, ShieldCheck, UserRoundCheck, Users as UsersIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../config';

const accessLabel = {
  master: 'Administrador',
  coordenador: 'Coordenador',
  usuario: 'Usuario',
};

const Users = () => {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/users/`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) {
        throw new Error('Nao foi possivel carregar usuarios.');
      }
      setUsers(await response.json());
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return users;
    return users.filter((item) => [item.full_name, item.username, item.email, item.access_level].join(' ').toLowerCase().includes(term));
  }, [query, users]);

  return (
    <div className="work-page">
      <section className="panel p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <span className="badge">Equipe</span>
            <h2 className="m-0 mt-3 text-2xl font-extrabold text-slate-950">Usuarios e permissoes</h2>
            <p className="m-0 mt-1 text-sm text-slate-500">Consulte contas ativas, perfis de acesso e contatos do workspace.</p>
          </div>
          <button className="button-secondary" type="button" onClick={loadUsers} disabled={loading}>
            <RefreshCw size={17} />
            Atualizar
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="metric-card">
          <p className="m-0 text-sm font-bold text-slate-500">Usuarios</p>
          <p className="m-0 mt-2 text-3xl font-extrabold text-slate-950">{users.length}</p>
        </article>
        <article className="metric-card">
          <p className="m-0 text-sm font-bold text-slate-500">Administradores</p>
          <p className="m-0 mt-2 text-3xl font-extrabold text-slate-950">{users.filter((item) => item.access_level === 'master').length}</p>
        </article>
        <article className="metric-card">
          <p className="m-0 text-sm font-bold text-slate-500">Ativos</p>
          <p className="m-0 mt-2 text-3xl font-extrabold text-slate-950">{users.filter((item) => item.is_active).length}</p>
        </article>
      </section>

      <section className="relative w-full max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
        <input className="input pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar usuario" />
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <section className="empty-state md:col-span-2 xl:col-span-3">
            <div className="spinner h-6 w-6" />
            <h2>Carregando usuarios</h2>
          </section>
        ) : filteredUsers.length === 0 ? (
          <section className="empty-state md:col-span-2 xl:col-span-3">
            <div className="empty-state__icon">
              <UsersIcon size={28} />
            </div>
            <h2>Nenhum usuario encontrado</h2>
            <p>Ajuste o termo de busca.</p>
          </section>
        ) : (
          filteredUsers.map((item) => (
            <article className="panel p-4" key={item.id}>
              <div className="flex items-start gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-slate-900 text-base font-extrabold text-white">
                  {(item.full_name || item.username || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="m-0 truncate text-base font-extrabold text-slate-950">{item.full_name || item.username}</h3>
                  <p className="m-0 text-sm text-slate-500">@{item.username}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className={`badge ${item.is_active ? 'badge--success' : 'badge--danger'}`}>
                      <UserRoundCheck size={13} />
                      {item.is_active ? 'Ativo' : 'Inativo'}
                    </span>
                    <span className="badge">
                      <ShieldCheck size={13} />
                      {accessLabel[item.access_level] || item.access_level}
                    </span>
                  </div>
                  <p className="m-0 mt-3 flex items-center gap-2 text-sm text-slate-500">
                    <Mail size={15} />
                    <span className="truncate">{item.email}</span>
                  </p>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
};

export default Users;
