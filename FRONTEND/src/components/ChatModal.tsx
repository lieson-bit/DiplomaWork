// components/ChatModal.tsx - Add email prop and display
import React, { useState, useEffect, useRef } from 'react';
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Send, X, Phone, Mail } from 'lucide-react';
import { orderApi } from '../src/lib/api';
import { toast } from 'sonner';
import { getCurrentUser } from '../src/lib/auth-utils';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  driverName?: string;
  driverPhone?: string;
  driverEmail?: string;  // Add email prop
  userType: 'customer' | 'driver';
}

export function ChatModal({ isOpen, onClose, orderId, driverName, driverPhone, driverEmail, userType }: ChatModalProps) {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen && orderId) {
      loadMessages();
      pollingInterval.current = setInterval(loadMessages, 5000);
    }
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, [isOpen, orderId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async () => {
    try {
      const response = await orderApi.getOrderMessages(orderId);
      if (response.success && response.data) {
        setMessages(response.data.messages || response.data || []);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    
    setSending(true);
    try {
      const response = await orderApi.sendMessage(orderId, newMessage.trim());
      if (response.success) {
        setNewMessage('');
        await loadMessages();
        toast.success('Message sent');
      } else {
        toast.error(response.error || 'Failed to send message');
      }
    } catch (error: any) {
      toast.error(error.message || 'Network error');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const currentUser = getCurrentUser();
  const currentUserId = currentUser?.id;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md h-[500px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-blue-100 text-blue-600">
                {driverName?.[0] || (userType === 'customer' ? 'D' : 'C')}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{driverName || (userType === 'customer' ? 'Driver' : 'Customer')}</h3>
              <p className="text-xs text-gray-500">
                {userType === 'customer' ? 'Driver' : 'Customer'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {driverPhone && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.open(`tel:${driverPhone}`)}
                title="Call"
              >
                <Phone className="h-4 w-4" />
              </Button>
            )}
            {driverEmail && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => window.open(`mailto:${driverEmail}`)}
                title="Email"
              >
                <Mail className="h-4 w-4" />
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Contact Info Bar */}
        {(driverPhone || driverEmail) && (
          <div className="px-4 py-2 bg-gray-50 border-b text-xs text-gray-600 flex gap-3">
            {driverPhone && <span>📞 {driverPhone}</span>}
            {driverEmail && <span>✉️ {driverEmail}</span>}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No messages yet. Start a conversation!
            </div>
          ) : (
            messages.map((msg, index) => {
              const isMe = msg.sender_id === currentUserId;
              return (
                <div
                  key={index}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg p-3 ${
                      isMe
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <p className="text-sm break-words">{msg.content}</p>
                    <p className={`text-xs mt-1 ${isMe ? 'text-blue-200' : 'text-gray-500'}`}>
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="flex-1"
            disabled={sending}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!newMessage.trim() || sending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}