import React, { useMemo, useState } from 'react';
import { Bot, CheckCircle2, KanbanSquare, Loader2, Send, Sparkles, Ticket } from 'lucide-react';
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

const Assistant = () => {
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
    <div className="work-page assistant-page">
      <section className="assistant-hero panel">
        <div>
          <span className="badge badge--success">
            <Sparkles size={13} />
            Assistente SorDChat
          </span>
          <h2>Descreva a solicitacao. O assistente cria o fluxo.</h2>
          <p>
            Ele entende se o pedido e ticket ou tarefa, identifica prioridade, setor, responsavel citado e prazo quando
            houver informacao no texto.
          </p>
        </div>
        <div className="assistant-hero__bot">
          <Bot size={34} />
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <form className="assistant-panel panel" onSubmit={submitRequest}>
          <label htmlFor="assistant-message">Solicitacao</label>
          <textarea
            id="assistant-message"
            className="textarea"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Ex: Crie um ticket urgente para TI sobre o notebook do comercial travando e atribua para Carlos."
            rows={8}
          />
          <div className="assistant-examples">
            {examples.map((item) => (
              <button key={item} type="button" onClick={() => setMessage(item)}>
                {item}
              </button>
            ))}
          </div>
          <button className="button-primary" type="submit" disabled={loading}>
            {loading ? <Loader2 className="assistant-spin" size={17} /> : <Send size={17} />}
            Criar com assistente
          </button>
        </form>

        <aside className="assistant-result panel">
          <div className="assistant-result__status">
            <span className={result ? 'badge badge--success' : 'badge'}>
              {result ? <CheckCircle2 size={13} /> : <Bot size={13} />}
              {actionLabel}
            </span>
          </div>

          {!result ? (
            <div className="assistant-empty">
              <Bot size={34} />
              <h3>Nenhuma solicitacao criada ainda</h3>
              <p>Escreva em linguagem natural e deixe o SorDChat organizar a acao.</p>
            </div>
          ) : (
            <div className="assistant-created">
              <div className="assistant-created__icon">
                {result.intent === 'task' ? <KanbanSquare size={24} /> : <Ticket size={24} />}
              </div>
              <h3>{createdItem?.title}</h3>
              <p>{result.reply}</p>
              <dl>
                <div><dt>Tipo</dt><dd>{result.intent === 'task' ? 'Tarefa' : 'Ticket'}</dd></div>
                <div><dt>Setor</dt><dd>{result.plan?.department || '-'}</dd></div>
                <div><dt>Prioridade</dt><dd>{priorityLabel[createdItem?.priority] || createdItem?.priority || result.plan?.ticket_priority || '-'}</dd></div>
                <div><dt>Responsavel</dt><dd>{result.plan?.assigned_to_name || 'Nao atribuido'}</dd></div>
                {result.plan?.due_date && <div><dt>Prazo</dt><dd>{result.plan.due_date}</dd></div>}
              </dl>
              <Link className="button-secondary" to={result.intent === 'task' ? '/tasks' : '/tickets'}>
                Ver {result.intent === 'task' ? 'Kanban' : 'tickets'}
              </Link>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
};

export default Assistant;
