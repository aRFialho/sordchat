import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, MessageSquare, ShieldCheck, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import BrandLogo from '../components/common/BrandLogo';

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
        <BrandLogo subtitle="Comunicacao, tarefas e suporte" textClassName="text-white" />

        <div className="max-w-2xl py-16">
          <span className="badge border-teal-500/30 bg-teal-500/10 text-teal-200">
            <ShieldCheck size={14} />
            Ambiente seguro
          </span>
          <h1 className="m-0 mt-5 text-4xl font-extrabold leading-tight text-white md:text-5xl">
            Um workspace direto para conversar, organizar e acompanhar o time.
          </h1>
          <p className="mt-5 max-w-xl text-base text-slate-300">
            Acesse o painel do SorDChat para conversar com a equipe, acompanhar atividades e organizar atendimentos.
          </p>
        </div>

        <div className="grid gap-3 text-sm text-slate-400 md:grid-cols-3">
          <span>Chat em tempo real</span>
          <span>Painel operacional</span>
          <span>Kanban integrado</span>
        </div>
      </section>

      <section className="flex items-center justify-center bg-slate-100 p-6 text-slate-950 lg:p-10">
        <div className="panel w-full max-w-md p-6 shadow-2xl">
          <div className="mb-6">
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-lg bg-teal-50 text-teal-700">
              <MessageSquare size={24} />
            </div>
            <h2 className="m-0 text-2xl font-extrabold">Entrar</h2>
            <p className="m-0 mt-1 text-sm text-slate-500">Use suas credenciais para acessar o workspace.</p>
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
                  placeholder="seu.usuario"
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
                  placeholder="sua senha"
                />
              </div>
            </label>

            <button type="submit" className="button-primary w-full" disabled={loading}>
              {loading ? <span className="spinner h-4 w-4" /> : <ArrowRight size={18} />}
              {loading ? 'Entrando...' : 'Entrar no SorDChat'}
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

export default Login;
