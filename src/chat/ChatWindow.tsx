import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Loader2, Check, X, AlertTriangle, MessageSquare } from 'lucide-react';
import { getOrCreateLocalKeys, importPublicKey, deriveSharedKey } from '../crypto/keyManager.js';
import { encryptText } from '../crypto/encrypt.js';
import { decryptText } from '../crypto/decrypt.js';
import { encryptFile } from '../crypto/imageCrypto.js';
import { EncryptedImage } from './EncryptedImage.js';
import VoiceCall from '../calls/VoiceCall.js';
import { supabase } from '../supabaseClient.js';
import {
  WinkingSmiley, VintagePhone, WingedLock, CatAvatar, WinkingShield, WingedHeart,
  KawaiiSmileBtn, PaletteIcon, PaperPlane, TinyLock, TinyCheck,
  MoodCat, MoodFox, MoodBear, CloudDecor, CodeCloud, BubbleStars
} from '../components/KawaiiIcons.js';

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
  };
  onLogout: () => void;
}

interface PartnerProfile {
  id: string;
  username: string;
  role: string;
  status: string;
  publicKey: string | null;
  mood: string | null;
}

interface MessageItem {
  id: number;
  senderId: string;
  recipientId: string;
  encryptedPayload: string;
  nonce: string;
  timestamp: string;
  decrypted?: {
    type: 'text' | 'image';
    body: string;
    mimeType?: string;
    fileNonce?: string;
  };
}

const emojis = ['🌸', '✨', '☁️', '🎀', '🧸', '🍭', '🍓', '🐾', '🍼', '🍰', '🍡', '🍦', '🍩', '🍪'];

export default function ChatWindow({ token: _token, currentUser, onLogout }: ChatWindowProps) {
  const [partner, setPartner] = useState<PartnerProfile | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [inputText, setInputText] = useState('');
  const [aesKey, setAesKey] = useState<CryptoKey | null>(null);
  const [partnerOnline, setPartnerOnline] = useState(false);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [myMood, setMyMood] = useState('');
  
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  
  // WebRTC call overlay state
  const [activeCall, setActiveCall] = useState<{
    partnerId: string;
    partnerUsername: string;
    mode: 'incoming' | 'outgoing' | 'connected';
    incomingOfferSdp?: any;
  } | null>(null);

  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isTyping, setIsTyping] = useState(false);

  const aesKeyRef = useRef<CryptoKey | null>(null);
  const myMoodRef = useRef<string>('');

  useEffect(() => {
    aesKeyRef.current = aesKey;
  }, [aesKey]);

  useEffect(() => {
    myMoodRef.current = myMood;
  }, [myMood]);

  const handleMoodChange = async (selectedMood: string) => {
    const nextMood = myMood === selectedMood ? '' : selectedMood;
    setMyMood(nextMood);

    try {
      await supabase
        .from('users')
        .update({ mood: nextMood })
        .eq('id', currentUser.id);

      if (channelRef.current) {
        await channelRef.current.track({
          userId: currentUser.id,
          isTyping: isTyping,
          mood: nextMood
        });
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
  const loadPartnerAndKeys = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .neq('id', currentUser.id)
        .eq('status', 'approved')
        .maybeSingle();

      if (error) {
        console.error('Error fetching partner details:', error.message);
        return;
      }

      if (!data) {
        setPartner(null);
        return;
      }

      setPartner({
        id: data.id,
        username: data.username,
        role: data.role,
        status: data.status,
        publicKey: data.public_key,
        mood: data.mood
      });

      if (data.public_key) {
        try {
          const myLocalKeys = await getOrCreateLocalKeys(currentUser.username);
          const importedPartnerPublicKey = await importPublicKey(JSON.parse(data.public_key));
          const derivedKey = await deriveSharedKey(myLocalKeys.privateKey, importedPartnerPublicKey);
          setAesKey(derivedKey);
        } catch (keyErr) {
          console.error('Error deriving key', keyErr);
        }
      }
    } catch (err) {
      console.error('Failed to load partner details', err);
    }
  }, [currentUser.id, currentUser.username]);

  useEffect(() => {
    loadPartnerAndKeysRef.current = loadPartnerAndKeys;
  }, [loadPartnerAndKeys]);

  // Connect Realtime Channels on mount
  useEffect(() => {
    loadPartnerAndKeys();
  }, [loadPartnerAndKeys]);

  // Handle Presence and Realtime messaging subscriptions
  useEffect(() => {
    if (!partner) return;

    // Use a unique room name for this pair of users
    const roomName = `room-duochat-sync`;
    const roomChannel = supabase.channel(roomName, {
      config: {
        presence: {
          key: currentUser.id
        }
      }
    });

    channelRef.current = roomChannel;
    setChannel(roomChannel);

    // Stream incoming messages in real-time
    roomChannel.on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages'
    }, async (payload) => {
      const newMsg = payload.new;
      if (
        (newMsg.sender_id === currentUser.id && newMsg.recipient_id === partner.id) ||
        (newMsg.sender_id === partner.id && newMsg.recipient_id === currentUser.id)
      ) {
        try {
          const key = aesKeyRef.current;
          if (!key) return;
          const plaintextJson = await decryptText(newMsg.encrypted_payload, newMsg.nonce, key);
          const decryptedObj = JSON.parse(plaintextJson);

          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [
              ...prev,
              {
                id: newMsg.id,
                senderId: newMsg.sender_id,
                recipientId: newMsg.recipient_id,
                encryptedPayload: newMsg.encrypted_payload,
                nonce: newMsg.nonce,
                timestamp: newMsg.created_at,
                decrypted: decryptedObj
              }
            ];
          });
        } catch (decErr) {
          console.error('Decrypt failed for new realtime message:', decErr);
        }
      }
    });

    // Stream deleted messages for unsend synchronization
    roomChannel.on('postgres_changes', {
      event: 'DELETE',
      schema: 'public',
      table: 'messages'
    }, (payload) => {
      const deletedId = payload.old.id;
      setMessages((prev) => prev.filter((m) => m.id !== deletedId));
    });

    // Realtime Presence Sync
    roomChannel.on('presence', { event: 'sync' }, () => {
      const state = roomChannel.presenceState();
      const partnerPresences = state[partner.id] as any[];
      if (partnerPresences && partnerPresences.length > 0) {
        const pres = partnerPresences[0];
        setPartnerOnline(true);
        setPartnerTyping(!!pres.isTyping);
        if (pres.mood !== undefined) {
          setPartner((prev: any) => prev ? { ...prev, mood: pres.mood } : null);
        }
      } else {
        setPartnerOnline(false);
        setPartnerTyping(false);
      }
    });

    // WebRTC signaling relay via Broadcast
    roomChannel.on('broadcast', { event: 'signal' }, (event) => {
      const payload = event.payload;
      if (payload.recipientId !== currentUser.id || payload.senderId !== partner.id) return;

      if (payload.type === 'call:initiate') {
        console.log(`Incoming WebRTC call requested from: ${payload.senderUsername}`);
        setActiveCall({
          partnerId: payload.senderId,
          partnerUsername: payload.senderUsername,
          mode: 'incoming'
        });
      } else if (payload.type === 'call:end' || payload.type === 'call:reject') {
        setActiveCall(null);
      }
    });

    roomChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Subscribed to Supabase Realtime Channels.');
        await roomChannel.track({
          userId: currentUser.id,
          isTyping: false,
          mood: myMoodRef.current
        });
      }
    });

    return () => {
      roomChannel.unsubscribe();
      channelRef.current = null;
      setChannel(null);
    };
  }, [partner, currentUser.id, currentUser.username]);

  // Load message history once AES Key is Derived
  useEffect(() => {
    const key = aesKey;
    if (!key || !partner) return;

    async function loadHistory() {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('Failed to load message history:', error.message);
          return;
        }

        const decryptedMessages = await Promise.all(data.map(async (msg) => {
          try {
            const plaintextJson = await decryptText(msg.encrypted_payload, msg.nonce, key!);
            return {
              id: msg.id,
              senderId: msg.sender_id,
              recipientId: msg.recipient_id,
              encryptedPayload: msg.encrypted_payload,
              nonce: msg.nonce,
              timestamp: msg.created_at,
              decrypted: JSON.parse(plaintextJson)
            };
          } catch (decErr) {
            console.error('Decrypt failed for message:', msg.id, decErr);
            return {
              id: msg.id,
              senderId: msg.sender_id,
              recipientId: msg.recipient_id,
              encryptedPayload: msg.encrypted_payload,
              nonce: msg.nonce,
              timestamp: msg.created_at,
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
  }, [aesKey, partner, currentUser.id]);

  // Scroll to bottom helper
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, partnerTyping]);

  // Typing Notification Emitters
  const handleInputChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);

    if (!partner) return;

    if (!isTyping) {
      setIsTyping(true);
      if (channelRef.current) {
        await channelRef.current.track({
          userId: currentUser.id,
          isTyping: true,
          mood: myMoodRef.current
        });
      }
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    typingTimeoutRef.current = setTimeout(async () => {
      setIsTyping(false);
      if (channelRef.current) {
        await channelRef.current.track({
          userId: currentUser.id,
          isTyping: false,
          mood: myMoodRef.current
        });
      }
    }, 1500);
  };

  // Send Encrypted Text Message
  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !partner || !aesKey) return;

    const messageContent = inputText;
    setInputText('');
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsTyping(false);
    
    if (channelRef.current) {
      await channelRef.current.track({
        userId: currentUser.id,
        isTyping: false,
        mood: myMoodRef.current
      });
    }

    try {
      const payload = {
        type: 'text' as const,
        body: messageContent
      };

      const encrypted = await encryptText(JSON.stringify(payload), aesKey);

      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUser.id,
          recipient_id: partner.id,
          encrypted_payload: encrypted.ciphertext,
          nonce: encrypted.nonce
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to save message:', error.message);
        alert('Failed to send message.');
        return;
      }

      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [
          ...prev,
          {
            id: data.id,
            senderId: data.sender_id,
            recipientId: data.recipient_id,
            encryptedPayload: data.encrypted_payload,
            nonce: data.nonce,
            timestamp: data.created_at,
            decrypted: payload
          }
        ];
      });

    } catch (err) {
      console.error(err);
    }
  };

  // Encrypt and Upload File directly to Supabase Storage
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !partner || !aesKey) return;

    try {
      const { encryptedBlob, nonce } = await encryptFile(file, aesKey);

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('uploads')
        .upload(fileName, encryptedBlob, {
          contentType: 'application/octet-stream'
        });

      if (uploadErr || !uploadData) {
        throw new Error(uploadErr?.message || 'Storage upload failed.');
      }

      const payload = {
        type: 'image' as const,
        body: uploadData.path,
        mimeType: file.type,
        fileNonce: nonce
      };

      const encrypted = await encryptText(JSON.stringify(payload), aesKey);

      const { data: dbData, error: dbErr } = await supabase
        .from('messages')
        .insert({
          sender_id: currentUser.id,
          recipient_id: partner.id,
          encrypted_payload: encrypted.ciphertext,
          nonce: encrypted.nonce
        })
        .select()
        .single();

      if (dbErr) {
        throw new Error(dbErr.message);
      }

      setMessages((prev) => {
        if (prev.some((m) => m.id === dbData.id)) return prev;
        return [
          ...prev,
          {
            id: dbData.id,
            senderId: dbData.sender_id,
            recipientId: dbData.recipient_id,
            encryptedPayload: dbData.encrypted_payload,
            nonce: dbData.nonce,
            timestamp: dbData.created_at,
            decrypted: payload
          }
        ];
      });

    } catch (err: any) {
      console.error('File share error:', err);
      alert(`Failed to securely share file: ${err.message}`);
    }
  };

  // Unsend Message (DB Delete)
  const handleUnsendMessage = async (messageId: string) => {
    if (!confirm('Are you sure you want to unsend this message?')) return;
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) {
        console.error('Failed to unsend message:', error.message);
      } else {
        setMessages((prev) => prev.filter((m) => m.id.toString() !== messageId));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Manage Admin Users (list and approve)
  const openAdminModal = async () => {
    setAdminModalOpen(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*');

      if (error) throw error;
      if (data) {
        setAdminUsers(data);
      }
    } catch (e) {
      console.error('Error fetching admin users list:', e);
    }
  };

  const handleUserApproveStatus = async (userId: string, newStatus: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: newStatus })
        .eq('id', userId);

      if (error) throw error;

      setAdminUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u))
      );
      loadPartnerAndKeys();
    } catch (e) {
      console.error('Failed to update user approval status:', e);
    }
  };

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
                            <button className="unsend-btn" onClick={() => handleUnsendMessage(msg.id.toString())}>
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
              {adminUsers.filter((u: any) => u.id !== currentUser.id).length === 0 ? (
                <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '20px' }}>No other registered users found.</div>
              ) : (
                adminUsers
                  .filter((u: any) => u.id !== currentUser.id)
                  .map((usr: any) => (
                    <div key={usr.id} className="user-item">
                      <div className="user-item-details">
                        <h5>{usr.username}</h5>
                        <p>Registered profile</p>
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
      {activeCall && channel && (
        <VoiceCall
          partnerId={activeCall.partnerId}
          partnerUsername={activeCall.partnerUsername}
          currentUserId={currentUser.id}
          mode={activeCall.mode}
          channel={channel}
          onEndCall={() => setActiveCall(null)}
          incomingOfferSdp={activeCall.incomingOfferSdp}
        />
      )}
    </div>
  );
}
