'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { GoogleGenAI, type LiveServerMessage, type Session } from '@google/genai';

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
 * Converts Float32Array audio samples to a base64-encoded 16-bit PCM string.
 */
function float32ToPcm16Base64(float32: Float32Array): string {
  const buffer = new ArrayBuffer(float32.length * 2);
  const view   = new DataView(buffer);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  // Convert ArrayBuffer to base64
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
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
        console.log('[VoiceCall] Audio format changed: sampleRate', this.sampleRate, '->', rate);
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

  const cleanup = useCallback(() => {
    console.log('[VoiceCall] cleanup() called, activeRef was:', activeRef.current);
    activeRef.current = false;

    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    micCtxRef.current?.close().catch(() => {});
    micCtxRef.current = null;

    playerRef.current?.stop();
    playerRef.current = null;

    try { sessionRef.current?.close(); } catch {}
    sessionRef.current = null;

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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (activeRef.current) cleanup();
    };
  }, [cleanup]);

  const startCall = useCallback(async () => {
    if (activeRef.current) return;

    setStatus('connecting');
    setError(null);
    console.log('[VoiceCall] Starting call for character:', characterId);

    try {
      // 1. Get ephemeral token from our server
      console.log('[VoiceCall] Step 1: Fetching ephemeral token...');
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
      console.log('[VoiceCall] Step 1 done: Got token, model =', model);

      // 2. Create browser-side GenAI client with ephemeral token
      // Ephemeral token support requires v1alpha per SDK docs
      console.log('[VoiceCall] Step 2: Creating GenAI client with v1alpha...');
      const ai = new GoogleGenAI({
        apiKey: token,
        httpOptions: { apiVersion: 'v1alpha' },
      });

      // 3. Set up audio playback
      const player = new AudioStreamPlayer();
      player.onPlayStart = () => {
        console.log('[VoiceCall] Audio playback started (AI speaking)');
        setAiSpeaking(true);
      };
      player.onPlayEnd = () => {
        console.log('[VoiceCall] Audio playback ended (AI done speaking)');
        setAiSpeaking(false);
      };
      playerRef.current = player;

      // Set active BEFORE connecting so callbacks see the correct state
      activeRef.current = true;

      // 4. Connect to Gemini Live
      // Config is baked into the ephemeral token's liveConnectConstraints
      console.log('[VoiceCall] Step 4: Connecting to Gemini Live...');
      let messageCount = 0;
      let audioChunkCount = 0;

      const session = await ai.live.connect({
        model,
        callbacks: {
          onopen: () => {
            console.log('[VoiceCall] WebSocket OPENED');
          },
          onmessage: (msg: LiveServerMessage) => {
            messageCount++;

            if (!activeRef.current) {
              console.log('[VoiceCall] Message received but call not active, ignoring');
              return;
            }

            // Log every message type for debugging
            if (msg.setupComplete) {
              console.log('[VoiceCall] Setup complete received');
            }

            if (msg.serverContent?.turnComplete) {
              console.log('[VoiceCall] Turn complete received (msg #' + messageCount + ')');
            }

            // Handle audio response chunks
            if (msg.serverContent?.modelTurn?.parts) {
              for (const part of msg.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  audioChunkCount++;
                  if (audioChunkCount <= 3 || audioChunkCount % 20 === 0) {
                    console.log(`[VoiceCall] Audio chunk #${audioChunkCount}, size: ${part.inlineData.data.length}, mimeType: ${part.inlineData.mimeType || 'none'}`);
                  }
                  if (part.inlineData.mimeType) {
                    player.updateFormat(part.inlineData.mimeType);
                  }
                  player.enqueue(part.inlineData.data);
                }
                if (part.text) {
                  console.log('[VoiceCall] Text from model:', part.text.slice(0, 100));
                  if (onTranscript) {
                    onTranscript('assistant', part.text);
                  }
                }
              }
            }

            // Log any other message fields for debugging
            if (!msg.serverContent && !msg.setupComplete) {
              console.log('[VoiceCall] Unknown message type:', JSON.stringify(msg).slice(0, 200));
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('[VoiceCall] WebSocket ERROR:', e.message, e);
            if (activeRef.current) {
              setError('Voice connection error: ' + (e.message || 'unknown'));
              cleanup();
            }
          },
          onclose: (e: CloseEvent) => {
            console.warn('[VoiceCall] WebSocket CLOSED: code =', e.code, 'reason =', e.reason, 'wasClean =', e.wasClean);
            if (activeRef.current) {
              setError('Voice session ended (code ' + e.code + ')');
              cleanup();
            }
          },
        },
      });

      sessionRef.current = session;
      console.log('[VoiceCall] Step 4 done: Connected to Gemini Live');

      // 5. Capture microphone as PCM and stream to Gemini
      console.log('[VoiceCall] Step 5: Requesting microphone...');
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
      console.log('[VoiceCall] Step 5 done: Mic stream acquired');

      const micCtx  = new AudioContext({ sampleRate: MIC_SAMPLE_RATE });
      micCtxRef.current = micCtx;
      const source    = micCtx.createMediaStreamSource(micStream);
      const processor = micCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      let silenceFrames = 0;
      let audioSendCount = 0;
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

        // Send audio to Gemini as base64 PCM (unless muted)
        if (!mutedRef.current) {
          const pcmBase64 = float32ToPcm16Base64(input);
          audioSendCount++;
          if (audioSendCount <= 3 || audioSendCount % 50 === 0) {
            console.log(`[VoiceCall] Sending audio chunk #${audioSendCount}, rms: ${rms.toFixed(4)}, base64 len: ${pcmBase64.length}`);
          }
          try {
            session.sendRealtimeInput({
              audio: {
                data: pcmBase64,
                mimeType: `audio/pcm;rate=${MIC_SAMPLE_RATE}`,
              },
            });
          } catch (sendErr) {
            console.error('[VoiceCall] Error sending audio:', sendErr);
          }
        }
      };

      source.connect(processor);
      processor.connect(micCtx.destination);

      // 6. Start call timer
      setCallDuration(0);
      timerRef.current = setInterval(() => {
        setCallDuration((d) => d + 1);
      }, 1000);

      setStatus('active');
      console.log('[VoiceCall] Call is now ACTIVE');
    } catch (err: unknown) {
      console.error('[VoiceCall] startCall error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start voice call');
      setStatus('error');
      cleanup();
    }
  }, [characterId, onTranscript, cleanup]);

  const endCall = useCallback(() => {
    console.log('[VoiceCall] endCall() called by user');
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
