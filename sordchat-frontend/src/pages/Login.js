import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, MessageSquare, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

const demoCredentials = [
  { username: 'admin', password: 'admin123', role: 'Administrador' },
  { username: 'coordenador', password: 'coord123', role: 'Coordenador' },
  { username: 'usuario', password: 'user123', role: 'Usuario' },
];

const Login = () => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!credentials.username || !credentials.password) {
      toast.error('Preencha usuario e senha.');
      return;
    }

    setLoading(true);
    const result = await login(credentials);
    setLoading(false);

    if (result.success) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="grid min-h-screen grid-cols-1 bg-slate-950 text-white lg:grid-cols-[1.05fr_0.95fr]">
      <section className="flex min-h-[42vh] flex-col justify-between p-8 lg:min-h-screen lg:p-12">
        <div className="flex items-center gap-3">
          <div className="brand-mark">S</div>
          <div>
            <p className="m-0 text-lg font-extrabold">SorDChat</p>
            <p className="m-0 text-sm text-slate-400">Comunicacao, tarefas e suporte</p>
          </div>
        </div>

        <div className="max-w-2xl py-16">
          <span className="badge border-teal-500/30 bg-teal-500/10 text-teal-200">Retomada do projeto</span>
          <h1 className="m-0 mt-5 text-4xl font-extrabold leading-tight text-white md:text-5xl">
            Um workspace direto para conversar, organizar e acompanhar o time.
          </h1>
          <p className="mt-5 max-w-xl text-base text-slate-300">
            Interface revisada para testes locais, com login demo, chat em tempo real e quadro de tarefas.
          </p>
        </div>

        <div className="grid gap-3 text-sm text-slate-400 md:grid-cols-3">
          <span>API local em 8001</span>
          <span>React + FastAPI</span>
          <span>SQLite para retomada rapida</span>
        </div>
      </section>

      <section className="flex items-center justify-center bg-slate-100 p-6 text-slate-950 lg:p-10">
        <div className="panel w-full max-w-md p-6 shadow-2xl">
          <div className="mb-6">
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-lg bg-teal-50 text-teal-700">
              <MessageSquare size={24} />
            </div>
            <h2 className="m-0 text-2xl font-extrabold">Entrar</h2>
            <p className="m-0 mt-1 text-sm text-slate-500">Use uma conta demo para avaliar o projeto.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Usuario</span>
              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  name="username"
                  type="text"
                  className="input pl-10"
                  value={credentials.username}
                  onChange={(event) => setCredentials((prev) => ({ ...prev, username: event.target.value }))}
                  autoComplete="username"
                  placeholder="admin"
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-bold text-slate-700">Senha</span>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  name="password"
                  type="password"
                  className="input pl-10"
                  value={credentials.password}
                  onChange={(event) => setCredentials((prev) => ({ ...prev, password: event.target.value }))}
                  autoComplete="current-password"
                  placeholder="admin123"
                />
              </div>
            </label>

            <button type="submit" className="button-primary w-full" disabled={loading}>
              {loading ? <span className="spinner h-4 w-4" /> : <ArrowRight size={18} />}
              {loading ? 'Entrando...' : 'Entrar no SorDChat'}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <p className="m-0 mb-3 text-xs font-extrabold uppercase tracking-wide text-slate-500">Credenciais demo</p>
            <div className="grid gap-2">
              {demoCredentials.map((demo) => (
                <button
                  key={demo.username}
                  type="button"
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-3 text-left transition hover:bg-slate-50"
                  onClick={() => setCredentials({ username: demo.username, password: demo.password })}
                >
                  <span>
                    <span className="block text-sm font-bold text-slate-900">{demo.username}</span>
                    <span className="block text-xs text-slate-500">{demo.role}</span>
                  </span>
                  <span className="text-xs font-bold text-teal-700">Usar</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Login;
