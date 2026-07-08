import { useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2 } from 'lucide-react';

interface VoiceCallProps {
  partnerId: string;
  partnerUsername: string;
  mode: 'incoming' | 'outgoing' | 'connected';
  socket: any;
  onEndCall: () => void;
  incomingOfferSdp?: any; // If caller sent an offer already
}

export default function VoiceCall({
  partnerId,
  partnerUsername,
  mode: initialMode,
  socket,
  onEndCall,
  incomingOfferSdp
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

  // Clean up media streams and RTCPeerConnection on unmount
  useEffect(() => {
    // Listen for peer hang up
    socket.on('call:end', () => {
      console.log('Call ended by peer');
      cleanupCall();
      onEndCall();
    });

    socket.on('call:reject', () => {
      console.log('Call rejected by peer');
      cleanupCall();
      onEndCall();
    });

    // Handle signaling from peer during negotiation
    socket.on('webrtc:offer', async ({ sdp }: any) => {
      if (pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
          const answer = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(answer);
          socket.emit('webrtc:answer', { recipientId: partnerId, sdp: answer });
          setCallState('connected');
        } catch (err) {
          console.error('Failed to handle incoming offer sdp', err);
        }
      }
    });

    socket.on('webrtc:answer', async ({ sdp }: any) => {
      if (pcRef.current) {
        try {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
          setCallState('connected');
        } catch (err) {
          console.error('Failed to set remote description of answer sdp', err);
        }
      }
    });

    socket.on('webrtc:ice-candidate', async ({ candidate }: any) => {
      if (pcRef.current) {
        try {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('Failed to add ICE candidate', err);
        }
      }
    });

    if (callState === 'outgoing') {
      // Start call negotiation immediately as caller
      startCall();
    } else if (callState === 'incoming' && incomingOfferSdp) {
      // Callee holds off initialization until they click "Accept"
    }

    return () => {
      socket.off('call:end');
      socket.off('call:reject');
      socket.off('webrtc:offer');
      socket.off('webrtc:answer');
      socket.off('webrtc:ice-candidate');
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
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] // Standard public Google STUN server
      });
      pcRef.current = pc;

      // Add local track to peer connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc:ice-candidate', { recipientId: partnerId, candidate: event.candidate });
        }
      };

      // Handle remote audio stream
      pc.ontrack = (event) => {
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };

      // 3. Send Call Request
      socket.emit('call:initiate', { recipientId: partnerId });

      // Handle when callee accepts
      socket.on('call:accept', async () => {
        try {
          // Callee accepted! Generate WebRTC Offer SDP
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('webrtc:offer', { recipientId: partnerId, sdp: offer });
        } catch (err) {
          console.error('Error generating offer', err);
        }
      });

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
          socket.emit('webrtc:ice-candidate', { recipientId: partnerId, candidate: event.candidate });
        }
      };

      pc.ontrack = (event) => {
        if (remoteAudioRef.current && event.streams[0]) {
          remoteAudioRef.current.srcObject = event.streams[0];
        }
      };

      // Emit accepted call back to caller
      socket.emit('call:accept', { recipientId: partnerId });
      setCallState('connected');
    } catch (err) {
      console.error('Microphone access denied', err);
      declineCall();
    }
  };

  const declineCall = () => {
    socket.emit('call:reject', { recipientId: partnerId });
    cleanupCall();
    onEndCall();
  };

  const endActiveCall = () => {
    socket.emit('call:end', { recipientId: partnerId });
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
          <p className="call-status">RINGING...</p>
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
