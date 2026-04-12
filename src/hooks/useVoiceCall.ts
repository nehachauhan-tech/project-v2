'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from '@google/genai';

export type VoiceCallStatus = 'idle' | 'connecting' | 'active' | 'error';

interface UseVoiceCallOptions {
  characterId: string;
  onTranscript?: (role: 'user' | 'assistant', text: string) => void;
}

interface UseVoiceCallReturn {
  status:       VoiceCallStatus;
  isMuted:      boolean;
  aiSpeaking:   boolean;
  userSpeaking: boolean;
  error:        string | null;
  callDuration: number;
  startCall:    () => Promise<void>;
  endCall:      () => void;
  toggleMute:   () => void;
}

// PCM sample rate for mic capture — Gemini expects 16kHz mono 16-bit
const MIC_SAMPLE_RATE = 16000;

/**
 * Converts a Float32Array of audio samples to a 16-bit PCM Blob.
 */
function float32ToPcm16Blob(float32: Float32Array): Blob {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view   = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return new Blob([buffer], { type: `audio/pcm;rate=${MIC_SAMPLE_RATE}` });
}

/**
 * Decodes base64 PCM audio data and queues it for playback via AudioContext.
 */
class AudioStreamPlayer {
  private ctx:          AudioContext;
  private queue:        AudioBuffer[] = [];
  private playing       = false;
  private sampleRate:   number;
  private bitsPerSample: number;
  onPlayStart?: () => void;
  onPlayEnd?:   () => void;

  constructor(sampleRate = 24000, bitsPerSample = 16) {
    this.ctx          = new AudioContext({ sampleRate });
    this.sampleRate   = sampleRate;
    this.bitsPerSample = bitsPerSample;
  }

  updateFormat(mimeType: string) {
    const rateMatch = mimeType.match(/rate=(\d+)/);
    if (rateMatch) {
      const rate = parseInt(rateMatch[1]);
      if (rate !== this.sampleRate) {
        this.sampleRate = rate;
        this.ctx.close();
        this.ctx = new AudioContext({ sampleRate: rate });
      }
    }
    const bitsMatch = mimeType.match(/L(\d+)/);
    if (bitsMatch) this.bitsPerSample = parseInt(bitsMatch[1]);
  }

  enqueue(base64Pcm: string) {
    const raw = atob(base64Pcm);
    const bytesPerSample = this.bitsPerSample / 8;
    const numSamples = raw.length / bytesPerSample;
    const audioBuffer = this.ctx.createBuffer(1, numSamples, this.sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    for (let i = 0; i < numSamples; i++) {
      const offset = i * bytesPerSample;
      // Read as little-endian signed 16-bit
      const lo = raw.charCodeAt(offset);
      const hi = raw.charCodeAt(offset + 1);
      let sample = (hi << 8) | lo;
      if (sample >= 0x8000) sample -= 0x10000;
      channelData[i] = sample / 0x8000;
    }

    this.queue.push(audioBuffer);
    if (!this.playing) this.playNext();
  }

  private playNext() {
    if (this.queue.length === 0) {
      this.playing = false;
      this.onPlayEnd?.();
      return;
    }

    if (!this.playing) {
      this.playing = true;
      this.onPlayStart?.();
    }

    const buffer = this.queue.shift()!;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.ctx.destination);
    source.onended = () => this.playNext();
    source.start();
  }

  stop() {
    this.queue = [];
    this.playing = false;
    this.ctx.close().catch(() => {});
  }
}

export function useVoiceCall({ characterId, onTranscript }: UseVoiceCallOptions): UseVoiceCallReturn {
  const [status, setStatus]             = useState<VoiceCallStatus>('idle');
  const [isMuted, setIsMuted]           = useState(false);
  const [aiSpeaking, setAiSpeaking]     = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  const sessionRef    = useRef<Session | null>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const processorRef  = useRef<ScriptProcessorNode | null>(null);
  const micCtxRef     = useRef<AudioContext | null>(null);
  const playerRef     = useRef<AudioStreamPlayer | null>(null);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const mutedRef      = useRef(false);
  const activeRef     = useRef(false);

  mutedRef.current = isMuted;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeRef.current) cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    activeRef.current = false;

    // Stop mic
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    micCtxRef.current?.close().catch(() => {});
    micCtxRef.current = null;

    // Stop playback
    playerRef.current?.stop();
    playerRef.current = null;

    // Close Gemini session
    try { sessionRef.current?.close(); } catch {}
    sessionRef.current = null;

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setAiSpeaking(false);
    setUserSpeaking(false);
    setCallDuration(0);
    setStatus('idle');
    setIsMuted(false);
  }, []);

  const startCall = useCallback(async () => {
    if (activeRef.current) return;

    setStatus('connecting');
    setError(null);

    try {
      // 1. Get ephemeral token from our server
      const tokenRes = await fetch('/api/chat/voice-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({}));
        throw new Error(err.error || `Token request failed (${tokenRes.status})`);
      }

      const { token, model } = await tokenRes.json();

      // 2. Create browser-side GenAI client with ephemeral token
      const ai = new GoogleGenAI({
        apiKey: token,
        httpOptions: { apiVersion: 'v1alpha' },
      });

      // 3. Set up audio playback
      const player = new AudioStreamPlayer();
      player.onPlayStart = () => setAiSpeaking(true);
      player.onPlayEnd   = () => setAiSpeaking(false);
      playerRef.current  = player;

      // 4. Connect to Gemini Live
      const session = await ai.live.connect({
        model,
        config: {
          responseModalities: [Modality.AUDIO],
        },
        callbacks: {
          onopen: () => {},
          onmessage: (msg: LiveServerMessage) => {
            if (!activeRef.current) return;

            // Handle audio response chunks
            if (msg.serverContent?.modelTurn?.parts) {
              for (const part of msg.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  if (part.inlineData.mimeType) {
                    player.updateFormat(part.inlineData.mimeType);
                  }
                  player.enqueue(part.inlineData.data);
                }
                if (part.text && onTranscript) {
                  onTranscript('assistant', part.text);
                }
              }
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Gemini Live error:', e.message);
            setError('Voice connection error');
            cleanup();
          },
          onclose: () => {
            if (activeRef.current) cleanup();
          },
        },
      });

      sessionRef.current = session;
      activeRef.current  = true;

      // 5. Capture microphone as PCM and stream to Gemini
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate:          MIC_SAMPLE_RATE,
          channelCount:        1,
          echoCancellation:    true,
          noiseSuppression:    true,
          autoGainControl:     true,
        },
      });
      streamRef.current = micStream;

      const micCtx  = new AudioContext({ sampleRate: MIC_SAMPLE_RATE });
      micCtxRef.current = micCtx;
      const source    = micCtx.createMediaStreamSource(micStream);
      // Buffer size 4096 at 16kHz ≈ 256ms chunks
      const processor = micCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // VAD-like: detect if user is speaking based on RMS
      let silenceFrames = 0;
      const SILENCE_THRESHOLD = 0.01;

      processor.onaudioprocess = (e) => {
        if (!activeRef.current) return;

        const input = e.inputBuffer.getChannelData(0);

        // Simple voice activity detection
        let sum = 0;
        for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
        const rms = Math.sqrt(sum / input.length);

        if (rms > SILENCE_THRESHOLD) {
          silenceFrames = 0;
          setUserSpeaking(true);
        } else {
          silenceFrames++;
          if (silenceFrames > 3) setUserSpeaking(false);
        }

        // Send to Gemini (unless muted)
        if (!mutedRef.current) {
          const pcmBlob = float32ToPcm16Blob(input);
          try {
            // The SDK runtime accepts browser Blobs despite the TS type being { data, mimeType }
            session.sendRealtimeInput({ audio: pcmBlob as any });
          } catch {}
        }
      };

      source.connect(processor);
      processor.connect(micCtx.destination); // required for ScriptProcessor to fire

      // 6. Start call timer
      setCallDuration(0);
      timerRef.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);

      setStatus('active');
    } catch (err: any) {
      console.error('Voice call start error:', err);
      setError(err.message || 'Failed to start voice call');
      setStatus('error');
      cleanup();
    }
  }, [characterId, onTranscript, cleanup]);

  const endCall = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const toggleMute = useCallback(() => {
    setIsMuted((m) => !m);
  }, []);

  return {
    status,
    isMuted,
    aiSpeaking,
    userSpeaking,
    error,
    callDuration,
    startCall,
    endCall,
    toggleMute,
  };
}
