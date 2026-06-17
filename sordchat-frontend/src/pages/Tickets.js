import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, MessageSquarePlus, Plus, Search, Ticket } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

const initialTickets = [
  {
    id: 'ticket-1',
    title: 'Configurar acesso do time comercial',
    customer: 'Equipe Comercial',
    priority: 'Alta',
    status: 'Aberto',
    channel: 'Interno',
    description: 'Liberar usuarios e validar permissao de coordenador.',
    createdAt: '2026-06-17',
  },
  {
    id: 'ticket-2',
    title: 'Revisar anexos enviados no chat',
    customer: 'Operacao',
    priority: 'Media',
    status: 'Em andamento',
    channel: 'Chat',
    description: 'Acompanhar arquivos recentes e confirmar formatos aceitos.',
    createdAt: '2026-06-17',
  },
  {
    id: 'ticket-3',
    title: 'Documentar fluxo de atendimento',
    customer: 'Suporte',
    priority: 'Baixa',
    status: 'Resolvido',
    channel: 'Web',
    description: 'Criar guia rapido para abertura e acompanhamento de chamados.',
    createdAt: '2026-06-16',
  },
];

const statusMeta = {
  Aberto: ['badge--danger', AlertCircle],
  'Em andamento': ['badge--warning', Clock3],
  Resolvido: ['badge--success', CheckCircle2],
};

const Tickets = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('sordchat:tickets')) || initialTickets;
    } catch {
      return initialTickets;
    }
  });
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Todos');
  const [formOpen, setFormOpen] = useState(false);
  const [draft, setDraft] = useState({
    title: '',
    customer: '',
    priority: 'Media',
    channel: 'Web',
    description: '',
  });

  const saveTickets = (nextTickets) => {
    setTickets(nextTickets);
    localStorage.setItem('sordchat:tickets', JSON.stringify(nextTickets));
  };

  const filteredTickets = useMemo(() => {
    const term = query.trim().toLowerCase();
    return tickets.filter((ticketItem) => {
      const matchesStatus = status === 'Todos' || ticketItem.status === status;
      const matchesQuery =
        !term ||
        [ticketItem.title, ticketItem.customer, ticketItem.description, ticketItem.channel]
          .join(' ')
          .toLowerCase()
          .includes(term);
      return matchesStatus && matchesQuery;
    });
  }, [query, status, tickets]);

  const stats = [
    ['Abertos', tickets.filter((item) => item.status === 'Aberto').length],
    ['Em andamento', tickets.filter((item) => item.status === 'Em andamento').length],
    ['Resolvidos', tickets.filter((item) => item.status === 'Resolvido').length],
  ];

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.customer.trim()) {
      toast.error('Informe titulo e solicitante.');
      return;
    }

    const nextTicket = {
      id: `ticket-${Date.now()}`,
      title: draft.title.trim(),
      customer: draft.customer.trim(),
      priority: draft.priority,
      status: 'Aberto',
      channel: draft.channel,
      description: draft.description.trim() || `Aberto por ${user?.full_name || user?.username || 'usuario'}.`,
      createdAt: new Date().toISOString().slice(0, 10),
    };

    saveTickets([nextTicket, ...tickets]);
    setDraft({ title: '', customer: '', priority: 'Media', channel: 'Web', description: '' });
    setFormOpen(false);
    toast.success('Ticket criado.');
  };

  const moveTicket = (ticketId, nextStatus) => {
    saveTickets(tickets.map((ticketItem) => (ticketItem.id === ticketId ? { ...ticketItem, status: nextStatus } : ticketItem)));
  };

  return (
    <div className="work-page">
      <section className="panel p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <span className="badge">Atendimento</span>
            <h2 className="m-0 mt-3 text-2xl font-extrabold text-slate-950">Fila de tickets</h2>
            <p className="m-0 mt-1 text-sm text-slate-500">
              Registre solicitacoes, acompanhe prioridades e mantenha o historico de atendimento visivel.
            </p>
          </div>
          <button className="button-primary" type="button" onClick={() => setFormOpen((value) => !value)}>
            <Plus size={17} />
            Novo ticket
          </button>
        </div>

        {formOpen && (
          <form className="mt-5 grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4" onSubmit={handleSubmit}>
            <div className="grid gap-3 md:grid-cols-2">
              <input
                className="input"
                value={draft.title}
                onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
                placeholder="Titulo do ticket"
              />
              <input
                className="input"
                value={draft.customer}
                onChange={(event) => setDraft((prev) => ({ ...prev, customer: event.target.value }))}
                placeholder="Solicitante ou area"
              />
            </div>
            <div className="grid gap-3 md:grid-cols-[160px_160px_1fr_auto]">
              <select className="select" value={draft.priority} onChange={(event) => setDraft((prev) => ({ ...prev, priority: event.target.value }))}>
                <option>Alta</option>
                <option>Media</option>
                <option>Baixa</option>
              </select>
              <select className="select" value={draft.channel} onChange={(event) => setDraft((prev) => ({ ...prev, channel: event.target.value }))}>
                <option>Web</option>
                <option>Chat</option>
                <option>Interno</option>
                <option>Email</option>
              </select>
              <input
                className="input"
                value={draft.description}
                onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Descricao breve"
              />
              <button className="button-primary" type="submit">
                <MessageSquarePlus size={17} />
                Criar
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {stats.map(([label, value]) => (
          <article className="metric-card" key={label}>
            <p className="m-0 text-sm font-bold text-slate-500">{label}</p>
            <p className="m-0 mt-2 text-3xl font-extrabold text-slate-950">{value}</p>
          </article>
        ))}
      </section>

      <section className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
          <input className="input pl-10" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar tickets" />
        </div>
        <div className="flex flex-wrap gap-2">
          {['Todos', 'Aberto', 'Em andamento', 'Resolvido'].map((item) => (
            <button key={item} className={`button-secondary ${status === item ? 'button-secondary--active' : ''}`} type="button" onClick={() => setStatus(item)}>
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3">
        {filteredTickets.map((ticketItem) => {
          const [badgeClass, StatusIcon] = statusMeta[ticketItem.status] || statusMeta.Aberto;
          return (
            <article className="panel p-4" key={ticketItem.id}>
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`badge ${badgeClass}`}>
                      <StatusIcon size={13} />
                      {ticketItem.status}
                    </span>
                    <span className="badge">{ticketItem.priority}</span>
                    <span className="badge">{ticketItem.channel}</span>
                  </div>
                  <h3 className="m-0 mt-3 text-lg font-extrabold text-slate-950">{ticketItem.title}</h3>
                  <p className="m-0 mt-1 text-sm text-slate-500">{ticketItem.description}</p>
                  <p className="m-0 mt-2 text-xs font-bold text-slate-400">
                    {ticketItem.customer} - {new Date(`${ticketItem.createdAt}T00:00:00`).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {['Aberto', 'Em andamento', 'Resolvido'].map((nextStatus) => (
                    <button
                      key={nextStatus}
                      className="button-secondary"
                      type="button"
                      disabled={ticketItem.status === nextStatus}
                      onClick={() => moveTicket(ticketItem.id, nextStatus)}
                    >
                      {nextStatus}
                    </button>
                  ))}
                </div>
              </div>
            </article>
          );
        })}

        {filteredTickets.length === 0 && (
          <section className="empty-state">
            <div className="empty-state__icon">
              <Ticket size={28} />
            </div>
            <h2>Nenhum ticket encontrado</h2>
            <p>Ajuste a busca ou abra um novo ticket.</p>
          </section>
        )}
      </section>
    </div>
  );
};

export default Tickets;
