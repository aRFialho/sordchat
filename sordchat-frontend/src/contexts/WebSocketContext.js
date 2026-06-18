import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';
import { API_BASE_URL, WS_BASE_URL } from '../config';

const WebSocketContext = createContext();

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket deve ser usado dentro de um WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();

  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const socketRef = useRef(null);
  const connectedRef = useRef(false);
  const pingIntervalRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Processar mensagens do WebSocket
  const handleWebSocketMessage = useCallback((data) => {
    switch (data.type) {
      case 'connection':
        break;

      case 'message_history':
        setMessages(data.messages);
        break;

      case 'new_message':
        setMessages(prev => {
          if (data.message.client_id) {
            const optimisticIndex = prev.findIndex(msg => msg.client_id === data.message.client_id);
            if (optimisticIndex >= 0) {
              return prev.map((msg, index) => (index === optimisticIndex ? { ...data.message, pending: false } : msg));
            }
          }

          if (prev.some(msg => msg.id === data.message.id)) {
            return prev;
          }

          return [...prev, data.message];
        });

        // Incrementar contador de não lidas se não for do usuário atual
        if (data.message.sender_id !== user?.id) {
          setUnreadCount(prev => prev + 1);

          // Notificação
          toast.success(`Nova mensagem de ${data.message.sender_name}`);
        }
        break;

      case 'user_status':
        if (data.is_online) {
          setOnlineUsers(prev => {
            const exists = prev.find(u => u.id === data.user_id);
            if (!exists) {
              return [...prev, {
                id: data.user_id,
                username: data.username,
                full_name: data.full_name
              }];
            }
            return prev;
          });
        } else {
          setOnlineUsers(prev => prev.filter(u => u.id !== data.user_id));
        }
        break;

      case 'online_users':
        setOnlineUsers(data.users.filter(u => u.id !== user?.id));
        break;

      case 'typing':
        if (data.user_id !== user?.id) {
          if (data.is_typing) {
            setTypingUsers(prev => {
              const exists = prev.find(u => u.id === data.user_id);
              if (!exists) {
                return [...prev, { id: data.user_id, username: data.username }];
              }
              return prev;
            });
          } else {
            setTypingUsers(prev => prev.filter(u => u.id !== data.user_id));
          }
        }
        break;

      case 'reaction_update':
        setMessages(prev => prev.map(msg =>
          msg.id === data.message_id
            ? { ...msg, reactions: data.reactions }
            : msg
        ));

        // Notificação de reação
        if (data.action === 'added' && data.user_name !== user?.full_name) {
          toast.success(`${data.user_name} reagiu com ${data.emoji}`);
        }
        break;

      case 'pong':
        break;

      default:
        console.debug('Mensagem WebSocket nao reconhecida:', data);
    }
  }, [user]);

  // Conectar ao WebSocket
  const connect = useCallback(() => {
    if (!isAuthenticated || !user || socketRef.current) {
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }

    try {
      const wsUrl = `${WS_BASE_URL}/messages/ws/${token}`;
      const newSocket = new WebSocket(wsUrl);

      newSocket.onopen = () => {
        setConnected(true);
        connectedRef.current = true;
        toast.success('Conectado ao chat em tempo real.');

        // Configurar ping periódico
        pingIntervalRef.current = setInterval(() => {
          if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      newSocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Erro ao processar mensagem WebSocket:', error);
        }
      };

      newSocket.onclose = (event) => {
        setConnected(false);
        connectedRef.current = false;

        // Limpar ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Limpar socket ref
        socketRef.current = null;
        setSocket(null);

        if (event.code !== 1000 && isAuthenticated) { // Não foi fechamento normal
          if (event.code === 1008) {
            toast.error('Token inválido. Faça login novamente.');
          } else {
            toast.error('Conexao perdida. Tentando reconectar...');

            // Tentar reconectar após 3 segundos
            reconnectTimeoutRef.current = setTimeout(() => {
              if (isAuthenticated && !socketRef.current) {
                connect();
              }
            }, 3000);
          }
        }
      };

      newSocket.onerror = (error) => {
        console.error('Erro no WebSocket:', error);
        toast.error('Erro na conexao em tempo real');
      };

      socketRef.current = newSocket;
      setSocket(newSocket);

    } catch (error) {
      console.error('Erro ao conectar WebSocket:', error);
      toast.error('Erro ao conectar ao chat');
    }
  }, [isAuthenticated, user, handleWebSocketMessage]);

  // Desconectar do WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.close(1000, 'Desconexão manual');
      socketRef.current = null;
    }

    setSocket(null);
    setConnected(false);
    connectedRef.current = false;
    setOnlineUsers([]);
    setTypingUsers([]);
  }, []);

  // Enviar mensagem
  const sendMessage = useCallback((content, receiverId = null, messageType = 'text', filePath = null) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      toast.error('Não conectado ao chat');
      return;
    }

    const clientId =
      typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `local-${Date.now()}`;
    const messageData = {
      type: 'chat_message',
      client_id: clientId,
      content,
      receiver_id: receiverId,
      message_type: messageType,
      file_path: filePath
    };

    try {
      setMessages(prev => [
        ...prev,
        {
          id: clientId,
          client_id: clientId,
          content,
          sender_id: user?.id,
          sender_name: user?.full_name || user?.username || 'Voce',
          receiver_id: receiverId,
          message_type: messageType,
          timestamp: new Date().toISOString(),
          file_path: filePath,
          pending: true,
        },
      ]);
      socketRef.current.send(JSON.stringify(messageData));
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setMessages(prev =>
        prev.map(msg => (msg.client_id === clientId ? { ...msg, pending: false, failed: true } : msg))
      );
      toast.error('Erro ao enviar mensagem');
    }
  }, [user]);

  // Enviar indicador de digitação
  const sendTypingIndicator = useCallback((isTyping, receiverId = null) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const typingData = {
      type: 'typing',
      is_typing: isTyping,
      receiver_id: receiverId
    };

    try {
      socketRef.current.send(JSON.stringify(typingData));
    } catch (error) {
      console.error('Erro ao enviar indicador de digitação:', error);
    }
  }, []);

  // Upload de arquivo
  const uploadFile = useCallback(async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/files/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Erro no upload');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Erro no upload:', error);
      throw error;
    }
  }, []);

  // Enviar reação
  const sendReaction = useCallback(async (messageId, emoji) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/messages/${messageId}/reactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ emoji }),
      });

      if (!response.ok) {
        throw new Error('Erro ao enviar reação');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Erro ao enviar reação:', error);
      toast.error('Erro ao reagir à mensagem');
      throw error;
    }
  }, []);

  // Marcar mensagens como lidas
  const markAsRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // Carregar histórico de mensagens
  const loadMessageHistory = useCallback(() => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: 'get_history' }));
    }
  }, []);

  // Efeitos
  useEffect(() => {
    if (isAuthenticated && user) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, user, connect, disconnect]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const value = {
    socket,
    connected,
    onlineUsers,
    messages,
    typingUsers,
    unreadCount,
    sendMessage,
    sendTypingIndicator,
    uploadFile,
    markAsRead,
    loadMessageHistory,
    connect,
    disconnect,
    sendReaction,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};
