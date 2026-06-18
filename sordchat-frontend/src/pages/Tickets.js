import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Download,
  MessageSquarePlus,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Ticket,
  Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config';
import { ACCEPTED_UPLOAD_LABEL, ACCEPTED_UPLOAD_TYPES } from '../constants/uploads';

const statusMeta = {
  Aberto: ['badge--danger', AlertCircle],
  'Em andamento': ['badge--warning', Clock3],
  Resolvido: ['badge--success', CheckCircle2],
};

const formatBytes = (bytes = 0) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
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

const uploadAttachment = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${API_BASE_URL}/files/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
    body: formData,
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Nao foi possivel enviar o anexo.');
  }
  return response.json();
};

const Tickets = () => {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Todos');
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [draft, setDraft] = useState({
    title: '',
    priority: 'Media',
    channel: 'Web',
    department: user?.department || '',
    assigned_to_id: '',
    description: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [ticketData, userData, departmentData] = await Promise.all([
        requestJson('/tickets/'),
        requestJson('/users/'),
        requestJson('/departments/'),
      ]);
      setTickets(ticketData);
      setUsers(userData);
      setDepartments(departmentData);
      setDraft((prev) => ({ ...prev, department: prev.department || departmentData[0] || user?.department || 'Operacao' }));
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTickets = useMemo(() => {
    const term = query.trim().toLowerCase();
    return tickets.filter((ticketItem) => {
      const matchesStatus = status === 'Todos' || ticketItem.status === status;
      const matchesQuery =
        !term ||
        [
          ticketItem.title,
          ticketItem.description,
          ticketItem.channel,
          ticketItem.department,
          ticketItem.created_by_name,
          ticketItem.assigned_to_name,
          ticketItem.attachment_filename,
        ]
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

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!draft.title.trim() || !draft.description.trim()) {
      toast.error('Informe titulo e descricao.');
      return;
    }

    setSaving(true);
    try {
      let attachmentFileId = null;
      if (attachment) {
        const uploaded = await uploadAttachment(attachment);
        attachmentFileId = uploaded.id;
      }

      await requestJson('/tickets/', {
        method: 'POST',
        body: JSON.stringify({
          ...draft,
          assigned_to_id: draft.assigned_to_id || null,
          attachment_file_id: attachmentFileId,
        }),
      });

      setDraft({
        title: '',
        priority: 'Media',
        channel: 'Web',
        department: departments[0] || user?.department || 'Operacao',
        assigned_to_id: '',
        description: '',
      });
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFormOpen(false);
      toast.success('Ticket criado.');
      await loadData();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const moveTicket = async (ticketId, nextStatus) => {
    try {
      await requestJson(`/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setTickets((current) => current.map((item) => (item.id === ticketId ? { ...item, status: nextStatus } : item)));
      toast.success('Ticket atualizado.');
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="work-page">
      <section className="panel p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <span className="badge">Atendimento</span>
            <h2 className="m-0 mt-3 text-2xl font-extrabold text-slate-950">Fila de tickets</h2>
            <p className="m-0 mt-1 text-sm text-slate-500">
              Registre solicitacoes, acompanhe prioridades e anexe arquivos ao atendimento.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="button-secondary" type="button" onClick={loadData} disabled={loading}>
              <RefreshCw size={17} />
              Atualizar
            </button>
            <button className="button-primary" type="button" onClick={() => setFormOpen((value) => !value)}>
              <Plus size={17} />
              Novo ticket
            </button>
          </div>
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
                value={draft.description}
                onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Descricao breve"
              />
            </div>
            <div className="grid gap-3 xl:grid-cols-[150px_150px_180px_1fr_180px_auto]">
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
              <select className="select" value={draft.department} onChange={(event) => setDraft((prev) => ({ ...prev, department: event.target.value }))}>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
              <select className="select" value={draft.assigned_to_id} onChange={(event) => setDraft((prev) => ({ ...prev, assigned_to_id: event.target.value }))}>
                <option value="">Sem responsavel</option>
                {users.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.full_name || item.username}
                  </option>
                ))}
              </select>
              <div>
                <input
                  ref={fileInputRef}
                  accept={ACCEPTED_UPLOAD_TYPES}
                  className="hidden"
                  type="file"
                  onChange={(event) => setAttachment(event.target.files?.[0] || null)}
                />
                <button className="button-secondary w-full" type="button" onClick={() => fileInputRef.current?.click()}>
                  <Upload size={17} />
                  Anexo
                </button>
              </div>
              <button className="button-primary" type="submit" disabled={saving}>
                {saving ? <span className="spinner h-4 w-4" /> : <MessageSquarePlus size={17} />}
                Criar
              </button>
            </div>
            <p className="m-0 text-xs font-bold text-slate-500">
              {attachment ? `Anexo: ${attachment.name} (${formatBytes(attachment.size)})` : `Formatos aceitos: ${ACCEPTED_UPLOAD_LABEL}.`}
            </p>
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
        {loading ? (
          <section className="empty-state">
            <div className="spinner h-6 w-6" />
            <h2>Carregando tickets</h2>
          </section>
        ) : filteredTickets.length === 0 ? (
          <section className="empty-state">
            <div className="empty-state__icon">
              <Ticket size={28} />
            </div>
            <h2>Nenhum ticket encontrado</h2>
            <p>Ajuste a busca ou abra um novo ticket.</p>
          </section>
        ) : (
          filteredTickets.map((ticketItem) => {
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
                      <span className="badge">{ticketItem.department || 'Sem setor'}</span>
                    </div>
                    <h3 className="m-0 mt-3 text-lg font-extrabold text-slate-950">{ticketItem.title}</h3>
                    <p className="m-0 mt-1 text-sm text-slate-500">{ticketItem.description}</p>
                    <p className="m-0 mt-2 text-xs font-bold text-slate-400">
                      {ticketItem.created_by_name || 'Solicitante'} - Responsavel: {ticketItem.assigned_to_name || 'Nao atribuido'}
                    </p>
                    {ticketItem.attachment_file_id && (
                      <a
                        className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-teal-700 underline"
                        href={`${API_BASE_URL}/files/download/${ticketItem.attachment_file_id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Paperclip size={15} />
                        {ticketItem.attachment_filename || 'Baixar anexo'}
                        {ticketItem.attachment_file_size ? ` (${formatBytes(ticketItem.attachment_file_size)})` : ''}
                        <Download size={15} />
                      </a>
                    )}
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
          })
        )}
      </section>
    </div>
  );
};

export default Tickets;
