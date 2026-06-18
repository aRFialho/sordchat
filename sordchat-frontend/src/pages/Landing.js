import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Download,
  LayoutDashboard,
  LockKeyhole,
  MessageSquare,
  MonitorDown,
  ServerCog,
} from 'lucide-react';
import BrandLogo from '../components/common/BrandLogo';
import { DESKTOP_DOWNLOAD_URL } from '../config';

const Landing = () => {
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <Link className="landing-brand" to="/">
          <BrandLogo />
        </Link>

        <nav className="landing-actions" aria-label="Acoes principais">
          <a className="button-secondary" href={DESKTOP_DOWNLOAD_URL}>
            <Download size={17} />
            Baixar app
          </a>
          <Link className="button-primary" to="/login">
            Login web
            <ArrowRight size={17} />
          </Link>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-hero__copy">
          <span className="badge badge--success">
            <CheckCircle2 size={14} />
            Pronto para Render + Neon
          </span>
          <h1>Sua central simples para conversar, organizar tarefas e acompanhar atendimentos.</h1>
          <p>
            O SorDChat une chat em tempo real, painel operacional e Kanban em uma interface leve para equipes internas.
            Use no navegador ou baixe o app desktop quando os builds forem publicados.
          </p>

          <div className="landing-cta">
            <Link className="button-primary" to="/login">
              Entrar pelo navegador
              <ArrowRight size={18} />
            </Link>
            <a className="button-secondary" href={DESKTOP_DOWNLOAD_URL}>
              <MonitorDown size={18} />
              Download desktop
            </a>
          </div>

          <div className="landing-notes">
            <span>API no Render</span>
            <span>Postgres Neon</span>
            <span>Migrations SQL</span>
          </div>
        </div>

        <div className="landing-preview" aria-label="Preview do SorDChat">
          <div className="landing-preview__top">
            <span />
            <span />
            <span />
          </div>
          <div className="landing-preview__body">
            <aside>
              <strong>SorDChat</strong>
              <small>Online</small>
              <p className="active">Dashboard</p>
              <p>Chat</p>
              <p>Tasks</p>
              <p>Arquivos</p>
            </aside>
            <section>
              <div className="preview-header">
                <h2>Dashboard</h2>
                <span>Sincronizado</span>
              </div>
              <div className="preview-grid">
                <article>
                  <MessageSquare size={19} />
                  <strong>25</strong>
                  <small>Mensagens</small>
                </article>
                <article>
                  <LayoutDashboard size={19} />
                  <strong>8</strong>
                  <small>Tasks</small>
                </article>
                <article>
                  <LockKeyhole size={19} />
                  <strong>3</strong>
                  <small>Perfis</small>
                </article>
              </div>
              <div className="preview-panel">
                <span />
                <span />
                <span />
              </div>
            </section>
          </div>
        </div>
      </section>

      <section className="landing-strip">
        <article>
          <MessageSquare size={22} />
          <h2>Chat em tempo real</h2>
          <p>WebSocket na API para conversas internas e mensagens diretas.</p>
        </article>
        <article>
          <ServerCog size={22} />
          <h2>Deploy controlado</h2>
          <p>Render com health check, env vars e migrations diretas no Neon.</p>
        </article>
        <article>
          <MonitorDown size={22} />
          <h2>Desktop app</h2>
          <p>Wrapper Electron preparado para gerar instalador e publicar download.</p>
        </article>
      </section>
    </main>
  );
};

export default Landing;
