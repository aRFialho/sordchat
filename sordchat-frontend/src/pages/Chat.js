import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Download,
  FileUp,
  MessageCircle,
  Paperclip,
  Search,
  Send,
  SmilePlus,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { API_BASE_URL } from '../config';

const emojiGroups = [
  {
    label: 'Reacoes',
    emojis: [
      '\u{1F600}',
      '\u{1F601}',
      '\u{1F602}',
      '\u{1F642}',
      '\u{1F60D}',
      '\u{1F91D}',
      '\u{1F44F}',
      '\u{1F64C}',
      '\u{1F44D}',
      '\u{1F44E}',
      '\u{2705}',
      '\u{1F525}',
      '\u{1F4A1}',
      '\u{1F680}',
      '\u{1F440}',
      '\u{1F64F}',
    ],
  },
  {
    label: 'Trabalho',
    emojis: [
      '\u{1F4CC}',
      '\u{1F4CE}',
      '\u{1F5C2}\u{FE0F}',
      '\u{1F4C1}',
      '\u{1F4C4}',
      '\u{1F4DD}',
      '\u{1F4CA}',
      '\u{1F4C8}',
      '\u{1F50E}',
      '\u{2699}\u{FE0F}',
      '\u{1F6E0}\u{FE0F}',
      '\u{23F1}\u{FE0F}',
      '\u{1F4C5}',
      '\u{1F3C1}',
      '\u{1F3AF}',
      '\u{1F4AC}',
    ],
  },
  {
    label: 'Status',
    emojis: [
      '\u{1F7E2}',
      '\u{1F7E1}',
      '\u{1F534}',
      '\u{26A0}\u{FE0F}',
      '\u{1F6A7}',
      '\u{1F512}',
      '\u{1F513}',
      '\u{2B50}',
      '\u{1F4AF}',
      '\u{2728}',
      '\u{1F4E3}',
      '\u{1F4E5}',
      '\u{1F4E4}',
      '\u{1F9FE}',
      '\u{1F197}',
      '\u{274C}',
    ],
  },
];

const Chat = () => {
  const { user } = useAuth();
  const {
    connected,
    onlineUsers,
    messages,
    typingUsers,
    unreadCount,
    sendMessage,
    sendTypingIndicator,
    markAsRead,
    uploadFile,
  } = useWebSocket();

  const [newMessage, setNewMessage] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiCategory, setEmojiCategory] = useState(emojiGroups[0].label);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    markAsRead();
  }, [markAsRead]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedUser]);

  const filteredMessages = useMemo(() => {
    const byConversation = selectedUser
      ? messages.filter(
          (message) =>
            (message.sender_id === selectedUser.id && message.receiver_id === user?.id) ||
            (message.sender_id === user?.id && message.receiver_id === selectedUser.id)
        )
      : messages.filter((message) => !message.receiver_id);

    if (!searchTerm.trim()) {
      return byConversation;
    }

    const term = searchTerm.toLowerCase();
    return byConversation.filter((message) => {
      const content = String(message.content || '').toLowerCase();
      const sender = String(message.sender_name || '').toLowerCase();
      return content.includes(term) || sender.includes(term);
    });
  }, [messages, searchTerm, selectedUser, user?.id]);

  const typingUser = selectedUser
    ? typingUsers.find((item) => item.id === selectedUser.id)
    : typingUsers.find((item) => item.id !== user?.id);
  const selectedEmojiGroup = emojiGroups.find((group) => group.label === emojiCategory) || emojiGroups[0];

  const handleTyping = (event) => {
    setNewMessage(event.target.value);
    sendTypingIndicator(true, selectedUser?.id);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      sendTypingIndicator(false, selectedUser?.id);
    }, 1200);
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!newMessage.trim()) {
      return;
    }

    sendMessage(newMessage.trim(), selectedUser?.id);
    sendTypingIndicator(false, selectedUser?.id);
    setNewMessage('');
    setShowEmojiPicker(false);
  };

  const handleMessageKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      handleSubmit(event);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setIsUploading(true);

    try {
      const result = await uploadFile(file);
      sendMessage(file.name, selectedUser?.id, 'file', result.id || result.file_path);
      toast.success('Arquivo enviado.');
    } catch (error) {
      toast.error(error.message || 'Nao foi possivel enviar o arquivo.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) {
      return '';
    }

    return new Date(timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="panel grid h-[calc(100vh-138px)] min-h-[620px] overflow-hidden lg:grid-cols-[320px_1fr]">
      <aside className="flex min-h-0 flex-col border-b border-slate-200 lg:border-b-0 lg:border-r">
        <div className="border-b border-slate-200 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="m-0 text-lg font-extrabold text-slate-950">Conversas</h2>
              <p className="m-0 text-sm text-slate-500">{connected ? 'Sincronizado' : 'Aguardando conexao'}</p>
            </div>
            <span className={`badge ${connected ? 'badge--success' : 'badge--danger'}`}>
              {connected ? 'Online' : 'Offline'}
            </span>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              className="input pl-10"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar mensagens"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <button
            className={`mb-2 flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
              !selectedUser ? 'border-teal-200 bg-teal-50' : 'border-transparent hover:bg-slate-50'
            }`}
            onClick={() => setSelectedUser(null)}
          >
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-900 text-white">
              <Users size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="m-0 text-sm font-extrabold text-slate-950">Chat geral</p>
              <p className="m-0 text-xs text-slate-500">{onlineUsers.length + 1} participantes</p>
            </div>
            {unreadCount > 0 && <span className="badge badge--warning">{unreadCount}</span>}
          </button>

          <p className="mb-2 mt-4 px-2 text-xs font-extrabold uppercase tracking-wide text-slate-400">
            Usuarios online
          </p>

          <div className="grid gap-1">
            {onlineUsers.length === 0 ? (
              <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Nenhum outro usuario online.</p>
            ) : (
              onlineUsers.map((onlineUser) => (
                <button
                  key={onlineUser.id}
                  className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
                    selectedUser?.id === onlineUser.id
                      ? 'border-teal-200 bg-teal-50'
                      : 'border-transparent hover:bg-slate-50'
                  }`}
                  onClick={() => setSelectedUser(onlineUser)}
                >
                  <div className="relative grid h-10 w-10 place-items-center rounded-lg bg-slate-100 font-bold text-slate-700">
                    {(onlineUser.full_name || onlineUser.username || 'U').charAt(0).toUpperCase()}
                    <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white bg-green-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="m-0 truncate text-sm font-extrabold text-slate-950">
                      {onlineUser.full_name || onlineUser.username}
                    </p>
                    <p className="m-0 text-xs text-slate-500">
                      {typingUsers.find((item) => item.id === onlineUser.id) ? 'digitando...' : 'online'}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </aside>

      <section className="flex min-h-0 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-100 text-slate-700">
              {selectedUser ? (
                <span className="font-extrabold">
                  {(selectedUser.full_name || selectedUser.username || 'U').charAt(0).toUpperCase()}
                </span>
              ) : (
                <MessageCircle size={20} />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="m-0 truncate text-base font-extrabold text-slate-950">
                {selectedUser ? selectedUser.full_name || selectedUser.username : 'Chat geral'}
              </h3>
              <p className="m-0 text-sm text-slate-500">
                {selectedUser ? 'Conversa direta' : `${onlineUsers.length + 1} participantes online`}
              </p>
            </div>
          </div>

          {searchTerm && <span className="badge">{filteredMessages.length} resultado(s)</span>}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-5">
          {!connected && (
            <div className="empty-state min-h-[320px]">
              <div className="empty-state__icon">
                <MessageCircle size={28} />
              </div>
              <h2>Chat desconectado</h2>
              <p>Inicie o backend para ativar mensagens em tempo real.</p>
            </div>
          )}

          {connected && filteredMessages.length === 0 && (
            <div className="empty-state min-h-[320px]">
              <div className="empty-state__icon">
                <MessageCircle size={28} />
              </div>
              <h2>Nenhuma mensagem</h2>
              <p>{searchTerm ? 'Tente outro termo de busca.' : 'Comece a conversa por aqui.'}</p>
            </div>
          )}

          <div className="grid gap-3">
            {filteredMessages.map((message) => {
              const isOwn = message.sender_id === user?.id;
              const isFile = message.message_type === 'file';

              return (
                <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`message-card max-w-[min(680px,82%)] p-3 ${isOwn ? 'bg-teal-700 text-white' : ''}`}>
                    {!isOwn && !selectedUser && (
                      <p className="m-0 mb-1 text-xs font-extrabold opacity-70">{message.sender_name}</p>
                    )}

                    {isFile ? (
                      <div className="flex items-center gap-3">
                        <div className={`grid h-9 w-9 place-items-center rounded-lg ${isOwn ? 'bg-white/15' : 'bg-slate-100'}`}>
                          <FileUp size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="m-0 truncate text-sm font-bold">{message.content}</p>
                          <a
                            className={`mt-1 inline-flex items-center gap-1 text-xs font-bold underline ${
                              isOwn ? 'text-teal-50' : 'text-teal-700'
                            }`}
                            href={`${API_BASE_URL}/files/download/${message.file_path}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <Download size={13} />
                            Baixar
                          </a>
                        </div>
                      </div>
                    ) : (
                      <p className="m-0 whitespace-pre-wrap text-sm">{message.content}</p>
                    )}

                    <p className={`m-0 mt-2 text-[11px] ${isOwn ? 'text-teal-50' : 'text-slate-500'}`}>
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {typingUser && (
            <p className="mt-3 text-sm font-semibold text-slate-500">{typingUser.username} esta digitando...</p>
          )}

          <div ref={messagesEndRef} />
        </div>

        <footer className="border-t border-slate-200 bg-white p-4">
          {showEmojiPicker && (
            <div className="emoji-picker mb-3">
              <div className="emoji-picker__tabs" role="tablist" aria-label="Categorias de emoji">
                {emojiGroups.map((group) => (
                  <button
                    key={group.label}
                    className={emojiCategory === group.label ? 'active' : ''}
                    type="button"
                    onClick={() => setEmojiCategory(group.label)}
                  >
                    {group.label}
                  </button>
                ))}
              </div>
              <div className="emoji-picker__grid">
                {selectedEmojiGroup.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    className="emoji-button"
                    type="button"
                    onClick={() => setNewMessage((prev) => `${prev}${emoji}`)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form className="flex items-center gap-2" onSubmit={handleSubmit}>
            <button
              className="icon-button icon-button--light"
              type="button"
              onClick={() => setShowEmojiPicker((value) => !value)}
              title="Emojis"
              aria-label="Emojis"
            >
              <SmilePlus size={18} />
            </button>

            <input ref={fileInputRef} className="hidden" type="file" onChange={handleFileUpload} />
            <button
              className="icon-button icon-button--light"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={!connected || isUploading}
              title="Anexar arquivo"
              aria-label="Anexar arquivo"
            >
              {isUploading ? <span className="spinner h-4 w-4" /> : <Paperclip size={18} />}
            </button>

            <textarea
              className="textarea min-h-[44px] min-w-0 flex-1 resize-none py-2"
              value={newMessage}
              onChange={handleTyping}
              onKeyDown={handleMessageKeyDown}
              disabled={!connected}
              rows={1}
              placeholder={selectedUser ? `Mensagem para ${selectedUser.full_name || selectedUser.username}` : 'Escreva uma mensagem'}
            />

            <button className="button-primary" type="submit" disabled={!connected || !newMessage.trim() || isUploading}>
              <Send size={17} />
              Enviar
            </button>
          </form>
        </footer>
      </section>
    </div>
  );
};

export default Chat;
