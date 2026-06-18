import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  Clock3,
  Download,
  MessageCircle,
  MessageSquarePlus,
  Paperclip,
  Plus,
  RefreshCw,
  Search,
  Send,
  Star,
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

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatResponseTime = (minutes) => {
  if (minutes === null || minutes === undefined) return 'Aguardando resposta';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
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
  return response.status === 204 ? null : response.json();
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
  const { user, isAdmin, isCoordinator } = useAuth();
  const fileInputRef = useRef(null);
  const messageFileRef = useRef(null);
  const [tickets, setTickets] = useState([]);
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('Todos');
  const [formOpen, setFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketMessages, setTicketMessages] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageAttachment, setMessageAttachment] = useState(null);
  const [transferUserId, setTransferUserId] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [closeNote, setCloseNote] = useState('');
  const [ratingScore, setRatingScore] = useState('5');
  const [ratingComment, setRatingComment] = useState('');
  const [draft, setDraft] = useState({
    title: '',
    priority: 'Media',
    channel: 'Web',
    department: user?.department || '',
    assigned_to_id: '',
    description: '',
  });

  const loadTicketDetail = async (ticketId = selectedTicketId) => {
    if (!ticketId) return;
    setDetailLoading(true);
    try {
      const [ticketData, messageData] = await Promise.all([
        requestJson(`/tickets/${ticketId}`),
        requestJson(`/tickets/${ticketId}/messages`),
      ]);
      setSelectedTicket(ticketData);
      setSelectedTicketId(ticketData.id);
      setTicketMessages(messageData);
      setTransferUserId(ticketData.assigned_to_id ? String(ticketData.assigned_to_id) : '');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDetailLoading(false);
    }
  };

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

  const canCloseSelected =
    selectedTicket &&
    selectedTicket.status !== 'Resolvido' &&
    (isAdmin() || isCoordinator() || selectedTicket.created_by_id === user?.id || selectedTicket.assigned_to_id === user?.id);

  const canRateSelected =
    selectedTicket &&
    selectedTicket.status === 'Resolvido' &&
    selectedTicket.created_by_id === user?.id &&
    !selectedTicket.rating_score;

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

      const createdTicket = await requestJson('/tickets/', {
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
      await loadTicketDetail(createdTicket.id);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const moveTicket = async (ticketId, nextStatus) => {
    try {
      const updatedTicket = await requestJson(`/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      setTickets((current) => current.map((item) => (item.id === ticketId ? updatedTicket : item)));
      if (selectedTicketId === ticketId) {
        await loadTicketDetail(ticketId);
      }
      toast.success('Ticket atualizado.');
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleOpenTicket = async (ticketId) => {
    setSelectedTicketId(ticketId);
    await loadTicketDetail(ticketId);
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!selectedTicket) return;
    if (!messageText.trim() && !messageAttachment) {
      toast.error('Digite uma mensagem ou anexe um arquivo.');
      return;
    }

    try {
      let fileId = null;
      if (messageAttachment) {
        const uploaded = await uploadAttachment(messageAttachment);
        fileId = uploaded.id;
      }

      await requestJson(`/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: messageText, file_id: fileId }),
      });
      setMessageText('');
      setMessageAttachment(null);
      if (messageFileRef.current) messageFileRef.current.value = '';
      await loadTicketDetail(selectedTicket.id);
      await loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleTransferTicket = async () => {
    if (!selectedTicket || !transferUserId) {
      toast.error('Selecione para quem passar o ticket.');
      return;
    }

    try {
      await requestJson(`/tickets/${selectedTicket.id}/transfer`, {
        method: 'PATCH',
        body: JSON.stringify({ assigned_to_id: transferUserId, message: transferNote }),
      });
      setTransferNote('');
      toast.success('Ticket repassado.');
      await loadTicketDetail(selectedTicket.id);
      await loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleCloseTicket = async () => {
    if (!selectedTicket) return;
    try {
      await requestJson(`/tickets/${selectedTicket.id}/close`, {
        method: 'POST',
        body: JSON.stringify({ message: closeNote }),
      });
      setCloseNote('');
      toast.success('Ticket fechado.');
      await loadTicketDetail(selectedTicket.id);
      await loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleRateTicket = async (event) => {
    event.preventDefault();
    if (!selectedTicket) return;
    try {
      await requestJson(`/tickets/${selectedTicket.id}/rating`, {
        method: 'POST',
        body: JSON.stringify({ rating_score: ratingScore, rating_comment: ratingComment }),
      });
      setRatingScore('5');
      setRatingComment('');
      toast.success('Avaliacao registrada.');
      await loadTicketDetail(selectedTicket.id);
      await loadData();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const handleDownloadFile = async (fileId, filename = 'anexo') => {
    try {
      const response = await fetch(`${API_BASE_URL}/files/download/${fileId}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) {
        throw new Error('Arquivo indisponivel para download.');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
              Registre solicitacoes, converse dentro do ticket, repasse responsaveis e acompanhe o tempo de resposta.
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
              <textarea
                className="textarea min-h-[42px]"
                value={draft.description}
                onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Descricao do atendimento"
                rows={2}
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

      <section className="tickets-workspace">
        <div className="grid content-start gap-3">
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
                <article className={`panel p-4 ${selectedTicketId === ticketItem.id ? 'ticket-card--active' : ''}`} key={ticketItem.id}>
                  <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
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
                      <p className="m-0 mt-1 line-clamp-2 text-sm text-slate-500">{ticketItem.description}</p>
                      <p className="m-0 mt-2 text-xs font-bold text-slate-400">
                        {ticketItem.created_by_name || 'Solicitante'} - Responsavel: {ticketItem.assigned_to_name || 'Nao atribuido'} - Resposta: {formatResponseTime(ticketItem.first_response_minutes)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button className="button-primary" type="button" onClick={() => handleOpenTicket(ticketItem.id)}>
                        <MessageCircle size={16} />
                        Abrir
                      </button>
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
        </div>

        <aside className="ticket-detail panel">
          {!selectedTicket ? (
            <div className="ticket-detail__empty">
              <Ticket size={32} />
              <h3>Abra um ticket</h3>
              <p>Selecione um atendimento para ver conversa, anexos, repasse, fechamento e avaliacao.</p>
            </div>
          ) : (
            <div className="ticket-detail__body">
              <header className="ticket-detail__header">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`badge ${(statusMeta[selectedTicket.status] || statusMeta.Aberto)[0]}`}>
                      {selectedTicket.status}
                    </span>
                    <span className="badge">Resposta: {formatResponseTime(selectedTicket.first_response_minutes)}</span>
                    {selectedTicket.rating_score && (
                      <span className="badge badge--success">
                        <Star size={13} />
                        {selectedTicket.rating_score}/5
                      </span>
                    )}
                  </div>
                  <h3>{selectedTicket.title}</h3>
                  <p>{selectedTicket.description}</p>
                </div>
              </header>

              <section className="ticket-detail__meta">
                <div><span>Solicitante</span><strong>{selectedTicket.created_by_name || '-'}</strong></div>
                <div><span>Responsavel</span><strong>{selectedTicket.assigned_to_name || 'Nao atribuido'}</strong></div>
                <div><span>Abertura</span><strong>{formatDateTime(selectedTicket.created_at)}</strong></div>
                <div><span>Fechamento</span><strong>{formatDateTime(selectedTicket.closed_at)}</strong></div>
              </section>

              {selectedTicket.attachment_file_id && (
                <button
                  className="button-secondary justify-self-start"
                  type="button"
                  onClick={() => handleDownloadFile(selectedTicket.attachment_file_id, selectedTicket.attachment_filename)}
                >
                  <Paperclip size={16} />
                  {selectedTicket.attachment_filename || 'Baixar anexo inicial'}
                  <Download size={16} />
                </button>
              )}

              <section className="ticket-actions">
                <div className="ticket-actions__transfer">
                  <select className="select" value={transferUserId} onChange={(event) => setTransferUserId(event.target.value)}>
                    <option value="">Selecionar responsavel</option>
                    {users.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.full_name || item.username}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input"
                    value={transferNote}
                    onChange={(event) => setTransferNote(event.target.value)}
                    placeholder="Mensagem de repasse"
                  />
                  <button className="button-secondary" type="button" onClick={handleTransferTicket}>
                    <ArrowRightLeft size={16} />
                    Passar
                  </button>
                </div>
                {canCloseSelected && (
                  <div className="ticket-actions__transfer">
                    <input
                      className="input"
                      value={closeNote}
                      onChange={(event) => setCloseNote(event.target.value)}
                      placeholder="Observacao de fechamento"
                    />
                    <button className="button-primary" type="button" onClick={handleCloseTicket}>
                      <CheckCircle2 size={16} />
                      Fechar
                    </button>
                  </div>
                )}
              </section>

              <section className="ticket-thread" aria-label="Conversa do ticket">
                {detailLoading ? (
                  <div className="ticket-thread__empty">
                    <div className="spinner h-5 w-5" />
                    Carregando atendimento
                  </div>
                ) : ticketMessages.length === 0 ? (
                  <div className="ticket-thread__empty">Nenhuma conversa registrada ainda.</div>
                ) : (
                  ticketMessages.map((message) => (
                    <article className={`ticket-message ${message.sender_id === user?.id ? 'ticket-message--own' : ''}`} key={message.id}>
                      <div className="ticket-message__head">
                        <strong>{message.sender_name}</strong>
                        <span>{formatDateTime(message.created_at)}</span>
                      </div>
                      {message.content && <p>{message.content}</p>}
                      {message.file_id && (
                        <button
                          className="button-secondary"
                          type="button"
                          onClick={() => handleDownloadFile(message.file_id, message.attachment_filename)}
                        >
                          <Paperclip size={15} />
                          {message.attachment_filename || 'Baixar anexo'}
                          {message.attachment_file_size ? ` (${formatBytes(message.attachment_file_size)})` : ''}
                        </button>
                      )}
                    </article>
                  ))
                )}
              </section>

              {selectedTicket.status !== 'Resolvido' ? (
                <form className="ticket-composer" onSubmit={handleSendMessage}>
                  <textarea
                    className="textarea"
                    value={messageText}
                    onChange={(event) => setMessageText(event.target.value)}
                    placeholder="Responder dentro do ticket"
                    rows={3}
                  />
                  <input
                    ref={messageFileRef}
                    accept={ACCEPTED_UPLOAD_TYPES}
                    className="hidden"
                    type="file"
                    onChange={(event) => setMessageAttachment(event.target.files?.[0] || null)}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <button className="button-secondary" type="button" onClick={() => messageFileRef.current?.click()}>
                      <Upload size={16} />
                      Anexar
                    </button>
                    <button className="button-primary" type="submit">
                      <Send size={16} />
                      Enviar
                    </button>
                    {messageAttachment && <span className="text-xs font-bold text-slate-500">{messageAttachment.name}</span>}
                  </div>
                </form>
              ) : (
                <section className="ticket-rating">
                  {selectedTicket.rating_score ? (
                    <div>
                      <p className="m-0 font-extrabold text-slate-950">Atendimento avaliado com {selectedTicket.rating_score}/5</p>
                      {selectedTicket.rating_comment && <p className="m-0 mt-1 text-sm text-slate-500">{selectedTicket.rating_comment}</p>}
                    </div>
                  ) : canRateSelected ? (
                    <form className="grid gap-2" onSubmit={handleRateTicket}>
                      <label className="text-sm font-extrabold text-slate-700">Avaliacao final</label>
                      <select className="select" value={ratingScore} onChange={(event) => setRatingScore(event.target.value)}>
                        <option value="5">5 - Excelente</option>
                        <option value="4">4 - Bom</option>
                        <option value="3">3 - Regular</option>
                        <option value="2">2 - Ruim</option>
                        <option value="1">1 - Muito ruim</option>
                      </select>
                      <textarea
                        className="textarea"
                        value={ratingComment}
                        onChange={(event) => setRatingComment(event.target.value)}
                        placeholder="Comentario opcional"
                        rows={2}
                      />
                      <button className="button-primary justify-self-start" type="submit">
                        <Star size={16} />
                        Avaliar ticket
                      </button>
                    </form>
                  ) : (
                    <p className="m-0 text-sm font-bold text-slate-500">Ticket resolvido aguardando avaliacao do solicitante.</p>
                  )}
                </section>
              )}
            </div>
          )}
        </aside>
      </section>
    </div>
  );
};

export default Tickets;
