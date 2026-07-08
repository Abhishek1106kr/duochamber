import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2 } from 'lucide-react';
import { RealtimeChannel } from '@supabase/supabase-js';

interface VoiceCallProps {
  partnerId: string;
  partnerUsername: string;
  currentUserId: string;
  mode: 'incoming' | 'outgoing' | 'connected';
  channel: RealtimeChannel;
  onEndCall: () => void;
  incomingOfferSdp?: any; // If caller sent an offer already
}

export default function VoiceCall({
  partnerId,
  partnerUsername,
  currentUserId,
  mode: initialMode,
  channel,
  onEndCall,
  incomingOfferSdp: _incomingOfferSdp
}: VoiceCallProps) {
  const [callState, setCallState] = useState<'incoming' | 'outgoing' | 'connected'>(initialMode);
  const [mute, setMute] = useState(false);
  const [timer, setTimer] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Setup local audio tag
  useEffect(() => {
    const audio = document.createElement('audio');
    audio.autoplay = true;
    remoteAudioRef.current = audio;
    document.body.appendChild(audio);

    return () => {
      audio.pause();
      audio.remove();
    };
  }, []);

  // Timer for connected call
  useEffect(() => {
    if (callState === 'connected') {
      timerIntervalRef.current = setInterval(() => {
        setTimer((t) => t + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      setTimer(0);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [callState]);

  // Helper to send a signaling event via broadcast channel
  const sendSignal = (type: string, payloadData: any = {}) => {
    channel.send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        type,
        senderId: currentUserId,
        recipientId: partnerId,
        ...payloadData
      }
    });
  };

  // Clean up media streams and RTCPeerConnection on unmount
  useEffect(() => {
    const handleSignal = async (event: any) => {
      const payload = event.payload;
      // Filter out messages not meant for us or from our partner
      if (payload.recipientId !== currentUserId || payload.senderId !== partnerId) return;

      switch (payload.type) {
        case 'call:end':
          console.log('Call ended by peer');
          cleanupCall();
          onEndCall();
          break;

        case 'call:reject':
          console.log('Call rejected by peer');
          cleanupCall();
          onEndCall();
          break;

        case 'webrtc:offer':
          if (pcRef.current) {
            try {
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
              const answer = await pcRef.current.createAnswer();
              await pcRef.current.setLocalDescription(answer);
              sendSignal('webrtc:answer', { sdp: answer });
              setCallState('connected');
            } catch (err) {
              console.error('Failed to handle incoming offer sdp', err);
            }
          }
          break;

        case 'webrtc:answer':
          if (pcRef.current) {
            try {
              await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.sdp));
              setCallState('connected');
            } catch (err) {
              console.error('Failed to set remote description of answer sdp', err);
            }
          }
          break;

        case 'webrtc:ice-candidate':
          if (pcRef.current) {
            try {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
            } catch (err) {
              console.error('Failed to add ICE candidate', err);
            }
          }
          break;

        case 'call:accept':
          try {
            if (pcRef.current) {
              const offer = await pcRef.current.createOffer();
              await pcRef.current.setLocalDescription(offer);
              sendSignal('webrtc:offer', { sdp: offer });
            }
          } catch (err) {
            console.error('Error generating offer on accept', err);
          }
          break;
      }
    };

    // Listen to broadcast signals
    channel.on('broadcast', { event: 'signal' }, handleSignal);

    if (callState === 'outgoing') {
      startCall();
    }

    return () => {
      cleanupCall();
    };
  }, [callState]);

  const startCall = async () => {
    try {
      // 1. Get mic permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      // 2. Initialize Peer Connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      pcRef.current = pc;

      // Add local track
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal('webrtc:ice-candidate', { candidate: event.candidate });
        }
      };

      // Handle remote audio stream
      pc.ontrack = (event) => {
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };

      // 3. Send Call Request
      sendSignal('call:initiate');

    } catch (err) {
      console.error('Microphone access denied', err);
      alert('Could not access microphone. Call terminated.');
      onEndCall();
    }
  };

  const acceptCall = async () => {
    try {
      // 1. Get local mic permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;

      // 2. Initialize Peer Connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      pcRef.current = pc;

      // Add tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal('webrtc:ice-candidate', { candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };

      // Emit accepted call back to caller
      sendSignal('call:accept');
      setCallState('connected');
    } catch (err) {
      console.error('Microphone access denied', err);
      declineCall();
    }
  };

  const declineCall = () => {
    sendSignal('call:reject');
    cleanupCall();
    onEndCall();
  };

  const endActiveCall = () => {
    sendSignal('call:end');
    cleanupCall();
    onEndCall();
  };

  const cleanupCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = mute;
      });
      setMute(!mute);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="call-overlay">
      <div className="call-avatar">
        {partnerUsername.substring(0, 2).toUpperCase()}
      </div>
      <h2 className="call-title">{partnerUsername}</h2>

      {callState === 'incoming' && (
        <>
          <p className="call-status">INCOMING CALL...</p>
          <div className="call-controls">
            <button className="call-btn decline" onClick={declineCall}>
              <PhoneOff size={28} />
            </button>
            <button className="call-btn accept" onClick={acceptCall}>
              <Phone size={28} />
            </button>
          </div>
        </>
      )}

      {callState === 'outgoing' && (
        <>
          <p className="call-status">RINGING Ringing...</p>
          <div className="call-controls">
            <button className="call-btn decline" onClick={endActiveCall}>
              <PhoneOff size={28} />
            </button>
          </div>
        </>
      )}

      {callState === 'connected' && (
        <>
          <p className="call-status">CONNECTED • {formatTimer(timer)}</p>
          <div className="call-controls">
            <button 
              className={`call-btn ${mute ? 'accept' : 'decline'}`} 
              onClick={toggleMute}
              style={{ backgroundColor: mute ? 'var(--success)' : 'var(--bg-surface)' }}
            >
              {mute ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
            <button className="call-btn decline" onClick={endActiveCall}>
              <PhoneOff size={28} />
            </button>
            <button className="call-btn" style={{ backgroundColor: 'var(--bg-surface)', cursor: 'default' }}>
              <Volume2 size={24} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
