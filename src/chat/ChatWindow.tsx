import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Loader2, Check, X, AlertTriangle, MessageSquare } from 'lucide-react';
import { getOrCreateLocalKeys, importPublicKey, deriveSharedKey } from '../crypto/keyManager.js';
import { encryptText } from '../crypto/encrypt.js';
import { decryptText } from '../crypto/decrypt.js';
import { encryptFile } from '../crypto/imageCrypto.js';
import { EncryptedImage } from './EncryptedImage.js';
import VoiceCall from '../calls/VoiceCall.js';
import {
  WinkingSmiley, VintagePhone, WingedLock, CatAvatar, WinkingShield, WingedHeart,
  KawaiiSmileBtn, PaletteIcon, PaperPlane, TinyLock, TinyCheck,
  MoodCat, MoodFox, MoodBear, CloudDecor, CodeCloud, BubbleStars
} from '../components/KawaiiIcons.js';
import { API_URL, WS_URL } from '../config.js';

const MOOD_OPTIONS = [
  { id: '🐱 Cat', label: 'Cat', Icon: MoodCat },
  { id: '🦊 Fox', label: 'Fox', Icon: MoodFox },
  { id: '🐻 Bear', label: 'Bear', Icon: MoodBear },
] as const;

interface ChatWindowProps {
  token: string;
  currentUser: {
    id: string;
    username: string;
    role: string;
    status: string;
    hasPublicKey: boolean;
    mood?: string;
  };
  onLogout: () => void;
}

interface MessageItem {
  id: string;
  senderId: string;
  recipientId: string;
  encryptedPayload: string;
  nonce: string;
  timestamp: string;
  // Decrypted fields
  decrypted?: {
    type: 'text' | 'image';
    body: string; // text or encrypted fileUrl
    mimeType?: string;
    fileNonce?: string;
  };
}

interface PartnerProfile {
  id: string;
  username: string;
  publicKey: string | null;
  mood?: string;
}

export default function ChatWindow({ token, currentUser, onLogout }: ChatWindowProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [partner, setPartner] = useState<PartnerProfile | null>(null);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [aesKey, setAesKey] = useState<CryptoKey | null>(null);
  
  // Message States
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Emojis
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojis = ['😀', '😂', '🥰', '😎', '👍', '🔥', '🎉', '❤️', '👀', '🙌', '✨', '👏', '💔', '🤔'];

  // Admin Pane State
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);

  // WebRTC Call state
  const [activeCall, setActiveCall] = useState<{
    partnerId: string;
    partnerUsername: string;
    mode: 'incoming' | 'outgoing' | 'connected';
    incomingOfferSdp?: any;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Scroll to bottom helper
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, partnerTyping]);

  const [myMood, setMyMood] = useState(currentUser.mood || '');
  const myMoodRef = useRef(myMood);

  useEffect(() => {
    myMoodRef.current = myMood;
  }, [myMood]);

  const handleMoodChange = async (selectedMood: string) => {
    const nextMood = myMood === selectedMood ? '' : selectedMood;
    setMyMood(nextMood);

    try {
      await fetch(`${API_URL}/api/auth/mood`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ mood: nextMood })
      });

      const currentPartner = partnerRef.current;
      if (socket && currentPartner) {
        socket.emit('mood:update', { recipientId: currentPartner.id, mood: nextMood });
      }
    } catch (err) {
      console.error('Failed to update mood:', err);
    }
  };

  const partnerRef = useRef<PartnerProfile | null>(null);
  const loadPartnerAndKeysRef = useRef<() => Promise<void>>();

  useEffect(() => {
    partnerRef.current = partner;
  }, [partner]);

  // Load Partner profile and derive Shared E2EE Key
  const loadPartnerAndKeys = React.useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/chat-partner`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return;

      const data: PartnerProfile = await res.json();
      if (!data) {
        setPartner(null);
        return;
      }

      setPartner(data);

      // Check partner's presence
      if (socket) {
        socket.emit('presence:get', { targetUserId: data.id }, (res: any) => {
          setPartnerOnline(res.status === 'online');
        });
      }

      // If they have generated their key, let's derive our Shared AES-GCM key!
      if (data.publicKey) {
        try {
          const myLocalKeys = await getOrCreateLocalKeys(currentUser.username);
          const importedPartnerPublicKey = await importPublicKey(JSON.parse(data.publicKey));
          const derivedKey = await deriveSharedKey(myLocalKeys.privateKey, importedPartnerPublicKey);
          setAesKey(derivedKey);
        } catch (keyErr) {
          console.error('Error deriving key', keyErr);
        }
      }
    } catch (err) {
      console.error('Failed to load partner details', err);
    }
  }, [token, currentUser.username, socket]);

  useEffect(() => {
    loadPartnerAndKeysRef.current = loadPartnerAndKeys;
  }, [loadPartnerAndKeys]);

  // Connect WebSockets on mount
  useEffect(() => {
    const socketInstance = io(WS_URL || '/', {
      auth: { token }
    });
    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      console.log('Socket.io connected');
      // Sync our mood to partner on connection
      const currentPartner = partnerRef.current;
      if (currentPartner) {
        socketInstance.emit('mood:update', { recipientId: currentPartner.id, mood: myMoodRef.current });
      }
    });

    // Handle Presence state of other users
    socketInstance.on('presence:state', ({ userId, status }) => {
      if (status === 'online') {
        loadPartnerAndKeysRef.current?.();
        // Emit our mood to the newly online partner
        const currentPartner = partnerRef.current;
        if (currentPartner && currentPartner.id === userId) {
          socketInstance.emit('mood:update', { recipientId: currentPartner.id, mood: myMoodRef.current });
        }
      }
      const currentPartner = partnerRef.current;
      if (currentPartner && currentPartner.id === userId) {
        setPartnerOnline(status === 'online');
      }
    });

    // Handle Mood updates from partner
    socketInstance.on('mood:state', ({ senderId, mood }) => {
      const currentPartner = partnerRef.current;
      if (currentPartner && currentPartner.id === senderId) {
        setPartner((prev) => prev ? { ...prev, mood } : null);
      }
    });

    // Typing State notifications
    socketInstance.on('typing:state', ({ senderId, isTyping }) => {
      const currentPartner = partnerRef.current;
      if (currentPartner && currentPartner.id === senderId) {
        setPartnerTyping(isTyping);
      }
    });

    // Handle Call Request (Incoming calls)
    socketInstance.on('call:request', ({ senderId, senderUsername }) => {
      console.log(`Incoming call request from: ${senderUsername}`);
      setActiveCall({
        partnerId: senderId,
        partnerUsername: senderUsername,
        mode: 'incoming'
      });
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [token]);

  useEffect(() => {
    loadPartnerAndKeys();
  }, [socket]);

  // Load message history once AES Key is Derived
  useEffect(() => {
    const key = aesKey;
    if (!key) return;

    async function loadHistory() {
      try {
        const res = await fetch(`${API_URL}/api/messages`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) return;

        const data: MessageItem[] = await res.json();

        // Decrypt all messages
        const decryptedMessages = await Promise.all(data.map(async (msg) => {
          try {
            const plaintextJson = await decryptText(msg.encryptedPayload, msg.nonce, key!);
            return {
              ...msg,
              decrypted: JSON.parse(plaintextJson)
            };
          } catch (decErr) {
            console.error('Decrypt failed for message:', msg.id, decErr);
            return {
              ...msg,
              decrypted: { type: 'text' as const, body: '[Corrupted payload - cannot decrypt]' }
            };
          }
        }));

        setMessages(decryptedMessages);
      } catch (err) {
        console.error('Failed to fetch message history', err);
      }
    }

    loadHistory();
  }, [aesKey, token]);

  // Subscribe to real-time messages once AES key is loaded
  useEffect(() => {
    if (!socket || !aesKey) return;

    const handleReceiveMessage = async (msg: MessageItem) => {
      try {
        const plaintextJson = await decryptText(msg.encryptedPayload, msg.nonce, aesKey);
        const decryptedObj = JSON.parse(plaintextJson);

        setMessages((prev) => [
          ...prev,
          {
            ...msg,
            decrypted: decryptedObj
          }
        ]);
      } catch (err) {
        console.error('Failed to decrypt received socket message', err);
      }
    };

    socket.on('message:receive', handleReceiveMessage);

    return () => {
      socket.off('message:receive', handleReceiveMessage);
    };
  }, [socket, aesKey]);

  // Typing Notification Emitters
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);

    if (!socket || !partner) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing:start', { recipientId: partner.id });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('typing:stop', { recipientId: partner.id });
    }, 1500);
  };

  // Send Encrypted Text Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !socket || !partner || !aesKey) return;

    const messageContent = inputText;
    setInputText('');
    
    // Stop typing indicator
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsTyping(false);
    socket.emit('typing:stop', { recipientId: partner.id });

    try {
      const payload = {
        type: 'text',
        body: messageContent
      };

      const encrypted = await encryptText(JSON.stringify(payload), aesKey);

      socket.emit('message:send', {
        recipientId: partner.id,
        encryptedPayload: encrypted.ciphertext,
        nonce: encrypted.nonce
      }, (res: any) => {
        if (res.success) {
          // Add locally
          setMessages((prev) => [
            ...prev,
            {
              ...res.message,
              decrypted: payload
            }
          ]);
        } else {
          alert('Failed to deliver message.');
        }
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Encrypt and Upload File
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !socket || !partner || !aesKey) return;

    try {
      // 1. Client-Side Encrypt the file binary
      const { encryptedBlob, nonce } = await encryptFile(file, aesKey);

      // 2. Upload the encrypted Blob to the server
      const formData = new FormData();
      formData.append('file', encryptedBlob, file.name);

      const uploadRes = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file');
      }

      const uploadData = await uploadRes.json();
      const fileUrl = uploadData.fileUrl;

      // 3. Send encrypted JSON message containing reference details
      const payload = {
        type: 'image',
        body: fileUrl,
        mimeType: file.type,
        fileNonce: nonce
      };

      const encrypted = await encryptText(JSON.stringify(payload), aesKey);

      socket.emit('message:send', {
        recipientId: partner.id,
        encryptedPayload: encrypted.ciphertext,
        nonce: encrypted.nonce
      }, (res: any) => {
        if (res.success) {
          setMessages((prev) => [
            ...prev,
            {
              ...res.message,
              decrypted: payload
            }
          ]);
        }
      });
    } catch (err) {
      console.error('File share error:', err);
      alert('Failed to securely share file.');
    }
  };

  // Unsend Message
  const handleUnsendMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to unsend this message?')) return;
    try {
      const res = await fetch(`${API_URL}/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Manage Admin Users (list and approve)
  const openAdminModal = async () => {
    setAdminModalOpen(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const users = await res.json();
        setAdminUsers(users);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleUserApproveStatus = async (userId: string, newStatus: 'approved' | 'rejected') => {
    try {
      const res = await fetch(`${API_URL}/api/auth/admin/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ userId, status: newStatus })
      });

      if (res.ok) {
        // Refresh list
        setAdminUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u))
        );
        // Refresh partner key if user approved partner
        loadPartnerAndKeys();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Render Time Helper
  const formatTime = (timeStr: string) => {
    const d = new Date(timeStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const startCall = () => {
    if (!partner || !partnerOnline) return;
    setActiveCall({
      partnerId: partner.id,
      partnerUsername: partner.username,
      mode: 'outgoing'
    });
  };

  return (
    <div className="app-shell">
      <CloudDecor className="cloud-bg cloud-bg-1" />
      <CloudDecor className="cloud-bg cloud-bg-2" />
      <CloudDecor className="cloud-bg cloud-bg-3" />

      {/* Title Bar */}
      <header className="title-bar">
        <div className="title-left">
          <span className="app-logo">DuoChat</span>
          <WinkingSmiley size={32} className="title-smiley" />
        </div>
        <button
          type="button"
          className="title-phone-btn"
          title="Secure Voice Call"
          onClick={startCall}
          disabled={!partner || !partnerOnline}
        >
          <VintagePhone size={28} />
        </button>
      </header>

      <div className="dashboard-container">
      {/* 1. Sidebar */}
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="user-cloud-frame">
            <span className="user-tag">{currentUser.username} ({currentUser.role})</span>
          </div>

          <div className="mood-row">
            <span className="mood-label">MOOD</span>
            <div className="mood-icons">
              {MOOD_OPTIONS.map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  className={`mood-btn ${myMood === id ? 'selected' : ''}`}
                  title={label}
                  onClick={() => handleMoodChange(id)}
                  aria-label={`Set mood to ${label}`}
                >
                  <Icon active={myMood === id} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="sidebar-content">
          <div className="section-title">
            <WingedLock size={18} />
            <span>Encrypted Channel</span>
          </div>
          
          {partner ? (
            <div className="room-partner-card" onClick={loadPartnerAndKeys}>
              <div className="avatar">
                <CatAvatar initials={partner.username.substring(0, 2).toUpperCase()} size={56} />
                <span className={`status-dot ${partnerOnline ? 'online' : ''}`}></span>
              </div>
              <div className="partner-info">
                <h4>{partner.username}</h4>
                <p className="partner-status-line">
                  {partnerOnline ? 'Connected' : 'Offline'}
                  {aesKey && (
                    <>
                      <span className="status-detail"><TinyLock size={12} /> Key Exchanged E2EE</span>
                      <span className="status-detail"><TinyCheck size={12} /></span>
                    </>
                  )}
                  {!aesKey && partner.publicKey && (
                    <span className="status-detail negotiating">
                      <Loader2 size={10} className="animate-spin" /> Keys Negotiating...
                    </span>
                  )}
                </p>
                {partner.mood && <span className="partner-mood-badge">{partner.mood}</span>}
              </div>
            </div>
          ) : (
            <div className="sidebar-empty">
              <MessageSquare size={32} className="empty-chat-icon" />
              <p>Waiting for another user to join the room.</p>
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          {currentUser.role === 'admin' && (
            <button className="kawaii-footer-btn" title="Admin Approvals Panel" onClick={openAdminModal}>
              <WinkingShield size={28} />
            </button>
          )}
          <button className="kawaii-footer-btn" title="Logout" onClick={onLogout} style={{ marginLeft: 'auto' }}>
            <WingedHeart size={28} />
          </button>
        </div>
      </div>

      {/* 2. Main Chat Window */}
      <div className="chat-window">
        {partner ? (
          <>
            {/* Header */}
            <div className="chat-header">
              <div className="header-partner-details">
                <h3>{partner.username}</h3>
                <p>{partnerOnline ? 'Online' : 'Offline'}</p>
              </div>
            </div>

            {/* Messages Viewport */}
            <div className="messages-viewport">
              {messages.length === 0 ? (
                <div className="empty-chat">
                  <div className="empty-chat-icon">🔒</div>
                  <h4>Secure Channel Active</h4>
                  <p>End-to-end encryption verified. Your messages are private.</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isUser = msg.senderId === currentUser.id;
                  const isPeer = !isUser;
                  const showDecor = isPeer && idx === messages.length - 1;
                  return (
                  <div key={msg.id} className={`message-row ${isUser ? 'user' : 'peer'}`}>
                    <div className="message-bubble">
                      {showDecor && <BubbleStars />}
                      {isUser && (
                        <button className="unsend-btn" onClick={() => handleUnsendMessage(msg.id)}>
                          unsend
                        </button>
                      )}
                      
                      {msg.decrypted?.type === 'text' && (
                        <p>{msg.decrypted.body}</p>
                      )}

                      {msg.decrypted?.type === 'image' && aesKey && (
                        <EncryptedImage 
                          src={msg.decrypted.body} 
                          nonce={msg.decrypted.fileNonce || msg.nonce} 
                          aesKey={aesKey} 
                          mimeType={msg.decrypted.mimeType || 'image/jpeg'} 
                        />
                      )}

                      <span className="message-time">{formatTime(msg.timestamp)}</span>
                    </div>
                  </div>
                  );
                })
              )}

              {partnerTyping && (
                <div className="typing-indicator-row">
                  <div className="typing-dots">
                    <span></span><span></span><span></span>
                  </div>
                  <span className="typing-text">{partner.username} is typing...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div className="chat-footer">
              {!aesKey && (
                <div className="key-warning">
                  <AlertTriangle size={16} />
                  <span>Key exchange incomplete. Waiting for the partner to set up encryption keys.</span>
                </div>
              )}
              
              <form onSubmit={handleSendMessage} className="input-container cloud-input">
                <button 
                  type="button" 
                  className="kawaii-input-btn" 
                  title="Insert emoji"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  disabled={!aesKey}
                >
                  <KawaiiSmileBtn size={32} />
                </button>

                {showEmojiPicker && (
                  <div className="emoji-picker-container">
                    {emojis.map((emoji) => (
                      <button 
                        key={emoji}
                        type="button" 
                        className="emoji-btn" 
                        onClick={() => {
                          setInputText((prev) => prev + emoji);
                          setShowEmojiPicker(false);
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}

                <label htmlFor="file-upload" className="kawaii-input-btn" title="Send Secure Image" style={{ cursor: aesKey ? 'pointer' : 'not-allowed', opacity: aesKey ? 1 : 0.4 }}>
                  <PaletteIcon size={32} />
                  <input 
                    type="file" 
                    id="file-upload" 
                    accept="image/*" 
                    style={{ display: 'none' }} 
                    onChange={handleFileUpload} 
                    disabled={!aesKey}
                  />
                </label>

                <textarea
                  className="chat-input"
                  value={inputText}
                  onChange={handleInputChange}
                  placeholder="Type an E2EE message..."
                  rows={1}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  disabled={!aesKey}
                />

                <button type="submit" className="kawaii-input-btn send-btn" title="Send message" disabled={!aesKey || !inputText.trim()}>
                  <PaperPlane size={32} />
                </button>
              </form>

              <CodeCloud />
            </div>
          </>
        ) : (
          <div className="empty-chat">
            <MessageSquare size={48} className="empty-chat-icon" />
            <h3>Secure Single-Room Lobby</h3>
            <p>Welcome to DuoChat. Waiting for the administrator to approve another user so you can start chatting securely.</p>
          </div>
        )}
      </div>
      </div>

      {/* 3. Admin Approval Modal */}
      {adminModalOpen && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Admin User Management</h3>
              <button className="icon-btn" onClick={() => setAdminModalOpen(false)} style={{ border: 'none', background: 'transparent' }}>
                <X size={20} />
              </button>
            </div>
            
            <div className="user-list">
              {adminUsers.filter((u) => u.id !== currentUser.id).length === 0 ? (
                <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '20px' }}>No other registered users found.</div>
              ) : (
                adminUsers
                  .filter((u) => u.id !== currentUser.id)
                  .map((usr) => (
                    <div key={usr.id} className="user-item">
                      <div className="user-item-details">
                        <h5>{usr.username}</h5>
                        <p>Registered: {new Date(usr.createdAt).toLocaleDateString()}</p>
                        <span className={`user-badge ${usr.status}`}>{usr.status}</span>
                      </div>
                      
                      <div className="user-actions">
                        {usr.status !== 'approved' && (
                          <button 
                            className="btn btn-primary btn-small"
                            onClick={() => handleUserApproveStatus(usr.id, 'approved')}
                          >
                            <Check size={14} /> Approve
                          </button>
                        )}
                        {usr.status !== 'rejected' && (
                          <button 
                            className="btn btn-secondary btn-small"
                            onClick={() => handleUserApproveStatus(usr.id, 'rejected')}
                          >
                            <X size={14} /> Reject
                          </button>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>

            <button className="btn btn-secondary" onClick={() => setAdminModalOpen(false)}>
              Close Panel
            </button>
          </div>
        </div>
      )}

      {/* 4. Voice Call Active Window Overlay */}
      {activeCall && (
        <VoiceCall
          partnerId={activeCall.partnerId}
          partnerUsername={activeCall.partnerUsername}
          mode={activeCall.mode}
          socket={socket}
          onEndCall={() => setActiveCall(null)}
          incomingOfferSdp={activeCall.incomingOfferSdp}
        />
      )}
    </div>
  );
}
