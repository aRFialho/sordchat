import React, { useMemo, useState } from 'react';
import { Bot, CheckCircle2, ChevronDown, KanbanSquare, Loader2, Send, Sparkles, Ticket, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '../config';

const examples = [
  'Abra um ticket urgente para TI: notebook da equipe comercial esta travando.',
  'Crie uma tarefa para Ana revisar contratos ate amanha.',
  'Registrar chamado para financeiro sobre reembolso pendente.',
];

const priorityLabel = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baixa',
};

const AssistantPopup = () => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const actionLabel = useMemo(() => {
    if (!result) return 'Aguardando solicitacao';
    return result.intent === 'task' ? 'Tarefa criada' : 'Ticket criado';
  }, [result]);

  const submitRequest = async (event) => {
    event.preventDefault();
    if (!message.trim()) {
      toast.error('Descreva o que o assistente deve criar.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/assistant/requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ message, execute: true }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Nao foi possivel acionar o assistente.');
      }

      const data = await response.json();
      setResult(data);
      toast.success(data.reply || 'Solicitacao criada.');
      setMessage('');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const createdItem = result?.ticket || result?.task;

  return (
    <div className={`assistant-popup ${open ? 'assistant-popup--open' : ''}`}>
      {open ? (
        <section className="assistant-popup__panel" aria-label="Assistente SorDChat">
          <header className="assistant-popup__header">
            <div className="assistant-popup__title">
              <span className="assistant-popup__mark">
                <Sparkles size={18} />
              </span>
              <div>
                <h2>Assistente</h2>
                <p>{actionLabel}</p>
              </div>
            </div>
            <div className="assistant-popup__actions">
              <button
                className="icon-button icon-button--light"
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Recolher assistente"
                title="Recolher assistente"
              >
                <ChevronDown size={18} />
              </button>
              <button
                className="icon-button icon-button--light"
                type="button"
                onClick={() => {
                  setOpen(false);
                  setMessage('');
                }}
                aria-label="Fechar assistente"
                title="Fechar assistente"
              >
                <X size={18} />
              </button>
            </div>
          </header>

          <form className="assistant-popup__form" onSubmit={submitRequest}>
            <label htmlFor="assistant-popup-message">Solicitacao</label>
            <textarea
              id="assistant-popup-message"
              className="textarea"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ex: Crie um ticket urgente para TI sobre o notebook do comercial travando e atribua para Carlos."
              rows={5}
            />
            <div className="assistant-popup__examples">
              {examples.map((item) => (
                <button key={item} type="button" onClick={() => setMessage(item)}>
                  {item}
                </button>
              ))}
            </div>
            <button className="button-primary" type="submit" disabled={loading}>
              {loading ? <Loader2 className="assistant-spin" size={17} /> : <Send size={17} />}
              Criar
            </button>
          </form>

          <div className="assistant-popup__result">
            <span className={result ? 'badge badge--success' : 'badge'}>
              {result ? <CheckCircle2 size={13} /> : <Bot size={13} />}
              {actionLabel}
            </span>

            {!result ? (
              <div className="assistant-popup__empty">
                <Bot size={28} />
                <p>Escreva em linguagem natural para criar tickets ou tarefas.</p>
              </div>
            ) : (
              <div className="assistant-popup__created">
                <div className="assistant-popup__created-title">
                  <span>{result.intent === 'task' ? <KanbanSquare size={18} /> : <Ticket size={18} />}</span>
                  <h3>{createdItem?.title}</h3>
                </div>
                <p>{result.reply}</p>
                <dl>
                  <div><dt>Tipo</dt><dd>{result.intent === 'task' ? 'Tarefa' : 'Ticket'}</dd></div>
                  <div><dt>Setor</dt><dd>{result.plan?.department || '-'}</dd></div>
                  <div><dt>Prioridade</dt><dd>{priorityLabel[createdItem?.priority] || createdItem?.priority || result.plan?.ticket_priority || '-'}</dd></div>
                  <div><dt>Responsavel</dt><dd>{result.plan?.assigned_to_name || 'Nao atribuido'}</dd></div>
                  {result.plan?.due_date && <div><dt>Prazo</dt><dd>{result.plan.due_date}</dd></div>}
                </dl>
                <Link className="button-secondary" to={result.intent === 'task' ? '/tasks' : '/tickets'} onClick={() => setOpen(false)}>
                  Ver {result.intent === 'task' ? 'Kanban' : 'tickets'}
                </Link>
              </div>
            )}
          </div>
        </section>
      ) : (
        <button
          className="assistant-popup__launcher"
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir assistente"
          title="Abrir assistente"
        >
          <Bot size={22} />
          <span>Assistente</span>
        </button>
      )}
    </div>
  );
};

export default AssistantPopup;
