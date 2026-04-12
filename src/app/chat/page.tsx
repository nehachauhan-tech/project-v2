'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Search, LogOut, User,
  Paperclip, FileText, Play, Pause,
  MessageCircle, ArrowLeft, Loader2, CheckCheck,
  X, Volume2, VolumeX, Settings, Mic, MicOff, Headphones,
  Music, Download, ExternalLink, Phone, PhoneOff,
} from 'lucide-react';
import { supabase_client } from '@/lib/supabase_client';
import { useRouter } from 'next/navigation';
import { AI_CHARACTERS, CHARACTER_MAP, type AICharacter } from '@/data/characters';
import type { Profile, Conversation, Message, OnlineUser, MessageType } from '@/types';
import { useVoiceCall } from '@/hooks/useVoiceCall';

const ACCEPT_TYPES: Record<string, MessageType> = {
  'image/': 'image',
  'audio/': 'audio',
  'video/': 'video',
};

function getMessageType(file: File): MessageType {
  for (const [prefix, type] of Object.entries(ACCEPT_TYPES)) {
    if (file.type.startsWith(prefix)) return type;
  }
  return 'document';
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// ─── Audio Player (voice message bubbles) ──────────────────
function AudioPlayer({ src, isOwn, accentColor }: { src: string; isOwn: boolean; accentColor?: string }) {
  const [playing, setPlaying]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading]   = useState(true);
  const audioRef = useRef<HTMLAudioElement>(null);

  const color = accentColor || '#10b981';

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else         { el.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    el.currentTime = ratio * duration;
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-3 min-w-[200px] max-w-[280px]">
      <audio
        ref={audioRef}
        src={src}
        onLoadedMetadata={(e) => { setDuration(e.currentTarget.duration); setLoading(false); }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          setProgress(el.duration ? el.currentTime / el.duration : 0);
        }}
        onEnded={() => { setPlaying(false); setProgress(0); }}
      />

      {/* Play / Pause */}
      <button
        onClick={toggle}
        disabled={loading}
        className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-transform active:scale-95 disabled:opacity-40"
        style={{ backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : color + '33' }}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {loading
          ? <Loader2 className="w-4 h-4 animate-spin text-white/50" />
          : playing
            ? <Pause className="w-4 h-4" style={{ color: isOwn ? '#fff' : color }} />
            : <Play  className="w-4 h-4 ml-0.5" style={{ color: isOwn ? '#fff' : color }} />}
      </button>

      <div className="flex-1 min-w-0">
        {/* Waveform progress bar */}
        <div
          className="relative h-8 flex items-center cursor-pointer group"
          onClick={seek}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          {/* Track */}
          <div className="absolute inset-y-0 flex items-center w-full gap-[2px]">
            {Array.from({ length: 30 }).map((_, i) => {
              const heights = [4,6,8,5,10,7,9,5,6,8,10,6,4,8,10,7,5,9,6,8,4,6,10,7,8,5,6,9,7,5];
              const filled  = i / 30 < progress;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-full transition-all duration-75"
                  style={{
                    height: `${heights[i]}px`,
                    backgroundColor: filled
                      ? (isOwn ? 'rgba(255,255,255,0.9)' : color)
                      : (isOwn ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.15)'),
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Duration */}
        <p className="text-[10px] mt-0.5" style={{ color: isOwn ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.3)' }}>
          {fmt(audioRef.current?.currentTime ?? 0)} / {duration ? fmt(duration) : '--:--'}
        </p>
      </div>

      {/* Mic icon label */}
      <Music className="w-3.5 h-3.5 flex-shrink-0 opacity-30" />
    </div>
  );
}

// ─── Music Player ───────────────────────────────────────────
function MusicPlayer({ mood, accentColor }: { mood: string; accentColor: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
      <button
        onClick={() => setIsPlaying(!isPlaying)}
        className="p-1 rounded-md hover:bg-white/[0.08] transition-colors"
        title={isPlaying ? 'Mute' : 'Play mood music'}
      >
        {isPlaying
          ? <Volume2 className="w-4 h-4" style={{ color: accentColor }} />
          : <VolumeX className="w-4 h-4 text-white/30" />}
      </button>
      <div className="flex items-center gap-1">
        {isPlaying && (
          <div className="flex items-end gap-[2px] h-3">
            {[10, 14, 8, 12].map((h, i) => (
              <div key={i} className="w-[3px] rounded-full animate-pulse"
                style={{ backgroundColor: accentColor, height: `${h}px`, animationDelay: `${i * 150}ms`, animationDuration: '0.8s' }}
              />
            ))}
          </div>
        )}
        <span className="text-[10px] text-white/30 ml-1">{mood}</span>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────
export default function ChatPage() {
  const [user, setUser]                         = useState<any>(null);
  const [profile, setProfile]                   = useState<Profile | null>(null);
  const [conversations, setConversations]       = useState<Conversation[]>([]);
  const [onlineUsers, setOnlineUsers]           = useState<OnlineUser[]>([]);
  const [allProfiles, setAllProfiles]           = useState<Profile[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [activeCharacter, setActiveCharacter]   = useState<AICharacter | null>(null);
  const [messages, setMessages]                 = useState<Message[]>([]);
  const [newMessage, setNewMessage]             = useState('');
  const [loading, setLoading]                   = useState(true);
  const [sending, setSending]                   = useState(false);
  const [searchQuery, setSearchQuery]           = useState('');
  const [showSidebar, setShowSidebar]           = useState(true);
  const [uploading, setUploading]               = useState(false);
  const [showCharacterInfo, setShowCharacterInfo] = useState(false);
  const [voiceMode, setVoiceMode]               = useState(false);   // AI replies as voice
  const [recording, setRecording]               = useState(false);   // mic recording active
  const [generatingVoice, setGeneratingVoice]   = useState(false);   // waiting for TTS

  const scrollRef           = useRef<HTMLDivElement>(null);
  const fileInputRef        = useRef<HTMLInputElement>(null);
  const mediaRecorderRef    = useRef<MediaRecorder | null>(null);
  const audioChunksRef      = useRef<Blob[]>([]);
  const router              = useRouter();

  // Stable refs — let realtime callbacks always see current values without stale closures
  const userRef             = useRef<any>(null);
  const activeConvRef       = useRef<Conversation | null>(null);
  const msgSubRef           = useRef<any>(null);   // current messages subscription

  userRef.current         = user;
  activeConvRef.current   = activeConversation;

  // ─── Live voice call ─────────────────────────────────────
  const [inLiveCall, setInLiveCall] = useState(false);
  const voiceCall = useVoiceCall({
    characterId: activeCharacter?.id ?? '',
    onTranscript: useCallback((role: 'user' | 'assistant', text: string) => {
      // Optionally capture transcripts — can be saved to DB later
    }, []),
  });

  // Sync inLiveCall with voiceCall.status
  useEffect(() => {
    setInLiveCall(voiceCall.status === 'active' || voiceCall.status === 'connecting');
  }, [voiceCall.status]);

  // ─── Fetch helpers ───────────────────────────────────────
  const fetchConversations = useCallback(async (userId: string) => {
    const { data } = await supabase_client
      .from('project_v2_conversations')
      .select('*')
      .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
      .order('last_message_at', { ascending: false });
    if (data) setConversations(data);
  }, []);

  const fetchMessages = useCallback(async (conversationId: string) => {
    const { data, error } = await supabase_client
      .from('project_v2_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (!error && data) setMessages(data);
  }, []);

  // ─── Subscribe to messages for a conversation ─────────────
  // Unsubscribes from any previous subscription first.
  // Returns a promise that resolves once the channel is SUBSCRIBED,
  // so callers can wait before fetching initial messages.
  const subscribeToMessages = useCallback((conversationId: string): Promise<void> => {
    // Remove old subscription cleanly
    if (msgSubRef.current) {
      supabase_client.removeChannel(msgSubRef.current);
      msgSubRef.current = null;
    }

    return new Promise<void>((resolve) => {
      const channel = supabase_client
        .channel(`msgs-${conversationId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'project_v2_messages',
          filter: `conversation_id=eq.${conversationId}`,
        }, (payload) => {
          const incoming = payload.new as Message;
          setMessages((prev) => {
            // Replace the FIRST matching optimistic temp message (by sender + content + role)
            let replaced = false;
            const next = prev.map((m) => {
              if (
                !replaced &&
                m.id.startsWith('temp-') &&
                m.sender_id === incoming.sender_id &&
                m.content === incoming.content &&
                m.role === incoming.role
              ) {
                replaced = true;
                return incoming;
              }
              return m;
            });
            if (replaced) return next;
            // Deduplicate by real ID
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming];
          });
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            resolve();
          }
          // If subscription fails, fall back to a full fetch
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            fetchMessages(conversationId);
            resolve(); // unblock caller even on error
          }
        });

      msgSubRef.current = channel;
    });
  }, [fetchMessages]);

  // ─── Auth + Init ─────────────────────────────────────────
  useEffect(() => {
    let presenceChannel: any  = null;
    let convChannel: any      = null;
    let authSub: any          = null;
    let mounted               = true;

    const bootstrap = async () => {
      try {
        // Use getUser instead of getSession to avoid stale local tokens causing a redirect loop
        const { data: { user: currentUser } } = await supabase_client.auth.getUser();

        if (!currentUser) {
          router.replace('/login');
          return;
        }

        const { data: prof } = await supabase_client
          .from('project_v2_profiles')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        if (!prof) {
          router.replace('/profile/setup');
          return;
        }

        if (!mounted) return;

        setUser(currentUser);
        setProfile(prof);

        await Promise.all([
          fetchConversations(currentUser.id),
          supabase_client
            .from('project_v2_profiles')
            .select('*')
            .neq('id', currentUser.id)
            .order('display_name')
            .then(({ data }) => { if (data && mounted) setAllProfiles(data); }),
        ]);

        // ── Presence ──
        presenceChannel = supabase_client.channel('online_users', {
          config: { presence: { key: currentUser.id } },
        });
        presenceChannel
          .on('presence', { event: 'sync' }, () => {
            const state = presenceChannel.presenceState();
            if (mounted) setOnlineUsers(Object.values(state).flat() as OnlineUser[]);
          })
          .subscribe(async (status: string) => {
            if (status === 'SUBSCRIBED') {
              await presenceChannel.track({
                user_id: currentUser.id,
                display_name: prof.display_name,
                avatar_url: prof.avatar_url,
                online_at: new Date().toISOString(),
              });
            }
          });

        // ── Conversations realtime (sidebar updates) ──
        convChannel = supabase_client
          .channel('conv-changes')
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'project_v2_conversations',
          }, (payload) => {
            const uid = userRef.current?.id;
            if (!uid || !mounted) return;

            // Merge updated conversation into state without full re-fetch
            if (payload.eventType === 'UPDATE') {
              const updated = payload.new as Conversation;
              setConversations((prev) =>
                prev.map((c) => c.id === updated.id ? updated : c)
                    .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())
              );
              // Also update activeConversation if it's the one that changed
              if (activeConvRef.current?.id === updated.id) {
                setActiveConversation(updated);
              }
            } else {
              // INSERT or DELETE — full refresh
              fetchConversations(uid);
            }
          })
          .subscribe();

        // ── Auth state change handler ──
        // Handles session expiry, token refresh, sign-out
        const { data: { subscription } } = supabase_client.auth.onAuthStateChange(
          (event, session) => {
            if (!mounted) return;
            if (event === 'SIGNED_OUT' || !session) {
              router.replace('/login');
            }
          }
        );
        authSub = subscription;

        if (mounted) setLoading(false);
      } catch (err) {
        console.error('Chat init error:', err);
        // Always exit loading state even on error to prevent permanent spinner
        if (mounted) setLoading(false);
      }
    };

    bootstrap();

    return () => {
      mounted = false;
      presenceChannel?.unsubscribe();
      convChannel && supabase_client.removeChannel(convChannel);
      authSub?.unsubscribe();
      if (msgSubRef.current) {
        supabase_client.removeChannel(msgSubRef.current);
        msgSubRef.current = null;
      }
    };
  }, [router, fetchConversations]);

  // ─── Mic stop (defined early so openConversation can use it) ─
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }, [recording]);

  // ─── Switch active conversation ───────────────────────────
  const openConversation = useCallback(async (conv: Conversation, character: AICharacter | null) => {
    setActiveConversation(conv);
    setActiveCharacter(character);
    setShowSidebar(false);
    setShowCharacterInfo(false);
    setMessages([]);
    setVoiceMode(false);
    setGeneratingVoice(false);
    if (recording) stopRecording();

    // Subscribe FIRST — wait until channel is active before fetching
    // so no INSERT events are missed between fetch and subscribe.
    await subscribeToMessages(conv.id);
    fetchMessages(conv.id);
  }, [fetchMessages, subscribeToMessages, recording, stopRecording]);

  // ─── Auto-scroll ──────────────────────────────────────────
  useEffect(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, [messages, sending]);

  // ─── Start user-to-user conversation ─────────────────────
  const startConversation = async (otherUserId: string) => {
    if (!user) return;

    // Check for existing conversation
    const { data: rows } = await supabase_client
      .from('project_v2_conversations')
      .select('*')
      .or(
        `and(participant_1.eq.${user.id},participant_2.eq.${otherUserId}),` +
        `and(participant_1.eq.${otherUserId},participant_2.eq.${user.id})`
      )
      .limit(1);

    const existing = rows?.[0];
    if (existing) { openConversation(existing, null); return; }

    const { data: conv } = await supabase_client
      .from('project_v2_conversations')
      .insert({ participant_1: user.id, participant_2: otherUserId })
      .select()
      .single();

    if (conv) {
      setConversations((prev) => [conv, ...prev]);
      openConversation(conv, null);
    }
  };

  // ─── Start AI character conversation ─────────────────────
  const startCharacterConversation = async (character: AICharacter) => {
    if (!user) return;

    const { data: rows } = await supabase_client
      .from('project_v2_conversations')
      .select('*')
      .eq('participant_1', user.id)
      .eq('bot_id', character.id)
      .limit(1);

    const existing = rows?.[0];
    if (existing) { openConversation(existing, character); return; }

    const { data: conv } = await supabase_client
      .from('project_v2_conversations')
      .insert({ participant_1: user.id, bot_id: character.id })
      .select()
      .single();

    if (conv) {
      setConversations((prev) => [conv, ...prev]);
      openConversation(conv, character);
    }
  };

  // ─── Request AI voice reply ──────────────────────────────
  const requestVoiceReply = useCallback(async (textMessage: string, textHistory: { role: string; content: string }[]) => {
    if (!activeConversation || !user || !activeCharacter) return;
    setGeneratingVoice(true);
    try {
      const res = await fetch('/api/chat/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId:    activeCharacter.id,
          message:        textMessage,
          history:        textHistory,
          conversationId: activeConversation.id,
          userId:         user.id,
        }),
      });
      const data = await res.json();
      if (data.audioUrl) {
        // Insert AI voice message into DB — realtime will pick it up
        await supabase_client.from('project_v2_messages').insert({
          conversation_id: activeConversation.id,
          sender_id:       user.id,
          role:            'assistant',
          content:         data.textFallback || '',
          message_type:    'audio',
          media_url:       data.audioUrl,
          media_name:      `${activeCharacter.name} voice reply`,
          media_size:      null,
        });
      } else if (data.textFallback) {
        // Audio not available — fall back to text
        await supabase_client.from('project_v2_messages').insert({
          conversation_id: activeConversation.id,
          sender_id:       user.id,
          role:            'assistant',
          content:         data.textFallback,
          message_type:    'text',
        });
      }
    } catch (err) {
      console.error('Voice reply error:', err);
    } finally {
      setGeneratingVoice(false);
    }
  }, [activeConversation, user, activeCharacter]);

  // ─── Mic recording ─────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 1000 || !activeConversation || !user) return;

        // Optimistic voice message — show immediately with spinner
        const tempId = `temp-${Date.now()}`;
        const localUrl = URL.createObjectURL(blob);
        const optimistic: Message = {
          id: tempId,
          conversation_id: activeConversation.id,
          sender_id: user.id,
          role: 'user',
          content: '',
          message_type: 'audio',
          media_url: localUrl,
          media_name: 'Voice message',
          media_size: blob.size,
          created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimistic]);

        setUploading(true);
        const filePath = `${user.id}/${activeConversation.id}/voice_${Date.now()}.webm`;
        const { error: uploadError } = await supabase_client.storage
          .from('project-v2-media').upload(filePath, blob, { contentType: 'audio/webm' });

        if (uploadError) {
          // Roll back optimistic message
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          setUploading(false);
          return;
        }

        const { data: urlData } = supabase_client.storage
          .from('project-v2-media').getPublicUrl(filePath);
        const { data: insertedRow, error: insertErr } = await supabase_client.from('project_v2_messages').insert({
          conversation_id: activeConversation.id,
          sender_id:       user.id,
          role:            'user',
          content:         '',
          message_type:    'audio',
          media_url:       urlData.publicUrl,
          media_name:      'Voice message',
          media_size:      blob.size,
        }).select().single();

        // Reconcile: swap temp for real row
        if (insertedRow) {
          setMessages((prev) => {
            if (!prev.some((m) => m.id === tempId)) return prev;
            return prev.map((m) => m.id === tempId ? insertedRow : m);
          });
        } else if (insertErr) {
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
        }
        setUploading(false);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (err) {
      console.error('Mic error:', err);
      alert('Could not access microphone. Please allow microphone permission.');
    }
  }, [recording, activeConversation, user]);

  // ─── Send Message ─────────────────────────────────────────
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversation || !user || sending) return;

    const content = newMessage.trim();
    setNewMessage('');

    // Optimistic UI — show immediately
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      conversation_id: activeConversation.id,
      sender_id: user.id,
      role: 'user',
      content,
      message_type: 'text',
      media_url: null,
      media_name: null,
      media_size: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    // Persist to DB — realtime will push back confirmed row
    // (subscribeToMessages dedup will swap the temp entry)
    const { data: insertedRow, error: insertErr } = await supabase_client
      .from('project_v2_messages')
      .insert({
        conversation_id: activeConversation.id,
        sender_id: user.id,
        role: 'user',
        content,
        message_type: 'text',
      })
      .select()
      .single();

    if (insertErr || !insertedRow) {
      console.error('Message insert error:', insertErr);
      // Roll back optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      return;
    }

    // Reconciliation: if realtime hasn't already swapped the temp, do it now.
    // This prevents the spinner from getting stuck if the realtime event was missed.
    setMessages((prev) => {
      const alreadyResolved = !prev.some((m) => m.id === tempId);
      if (alreadyResolved) return prev; // realtime already handled it
      return prev.map((m) => m.id === tempId ? insertedRow : m);
    });

    // AI response
    if (activeCharacter) {
      const history = messages
        .filter((m) => !m.id.startsWith('temp-'))
        .slice(-100)
        .map((m) => ({ role: m.role, content: m.content }));

      if (voiceMode) {
        // Voice mode: get TTS audio reply
        await requestVoiceReply(content, history);
      } else {
        // Text mode: get text reply
        setSending(true);
        try {
          const res = await fetch('/api/chat/ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ characterId: activeCharacter.id, message: content, history }),
          });

          if (!res.ok) throw new Error(`AI API ${res.status}`);

          const data = await res.json();
          if (data.response) {
            await supabase_client.from('project_v2_messages').insert({
              conversation_id: activeConversation.id,
              sender_id:       user.id,
              role:            'assistant',
              content:         data.response,
              message_type:    'text',
            });
          }
        } catch (err) {
          console.error('AI error:', err);
        } finally {
          setSending(false);
        }
      }
    }
  };

  // ─── File Upload ──────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation || !user) return;
    if (file.size > 50 * 1024 * 1024) { alert('File must be under 50MB.'); return; }

    const msgType = getMessageType(file);

    // Optimistic message — show immediately with local preview
    const tempId = `temp-${Date.now()}`;
    const localUrl = URL.createObjectURL(file);
    const optimistic: Message = {
      id: tempId,
      conversation_id: activeConversation.id,
      sender_id: user.id,
      role: 'user',
      content: '',
      message_type: msgType,
      media_url: localUrl,
      media_name: file.name,
      media_size: file.size,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    setUploading(true);
    const ext = file.name.split('.').pop();
    const filePath = `${user.id}/${activeConversation.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase_client.storage
      .from('project-v2-media').upload(filePath, file);
    if (uploadError) {
      console.error('Upload error:', uploadError);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase_client.storage
      .from('project-v2-media').getPublicUrl(filePath);

    const { data: insertedRow, error: insertErr } = await supabase_client.from('project_v2_messages').insert({
      conversation_id: activeConversation.id,
      sender_id: user.id,
      role: 'user',
      content: '',
      message_type: msgType,
      media_url: urlData.publicUrl,
      media_name: file.name,
      media_size: file.size,
    }).select().single();

    // Reconcile: swap temp for real row
    if (insertedRow) {
      setMessages((prev) => {
        if (!prev.some((m) => m.id === tempId)) return prev;
        return prev.map((m) => m.id === tempId ? insertedRow : m);
      });
    } else if (insertErr) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Helpers ──────────────────────────────────────────────
  const getOtherProfile = useCallback((conv: Conversation): Profile | undefined => {
    if (!user) return undefined;
    const otherId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1;
    return allProfiles.find((p) => p.id === otherId);
  }, [user, allProfiles]);

  const getCharacterForConv = (conv: Conversation) =>
    conv.bot_id ? CHARACTER_MAP[conv.bot_id] : undefined;

  const isUserOnline = (uid: string) => onlineUsers.some((u) => u.user_id === uid);

  const handleLogout = async () => {
    await supabase_client.auth.signOut();
    router.replace('/login');
  };

  // ─── Filtered sidebar lists ───────────────────────────────
  const filteredProfiles = allProfiles.filter((p) =>
    p.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const onlineProfileIds = new Set(onlineUsers.map((u) => u.user_id));
  const convPartnerIds = new Set(
    conversations
      .filter((c) => !c.bot_id)
      .map((c) => (c.participant_1 === user?.id ? c.participant_2 : c.participant_1))
      .filter(Boolean) as string[]
  );
  const onlineProfiles   = filteredProfiles.filter((p) => onlineProfileIds.has(p.id));
  const pastConvProfiles = filteredProfiles.filter((p) => convPartnerIds.has(p.id) && !onlineProfileIds.has(p.id));
  const otherProfiles    = filteredProfiles.filter((p) => !onlineProfileIds.has(p.id) && !convPartnerIds.has(p.id));
  const filteredCharacters = searchQuery
    ? AI_CHARACTERS.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.role.toLowerCase().includes(searchQuery.toLowerCase()))
    : AI_CHARACTERS;

  // ─── Loading screen ───────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  // ─── Chat header values ───────────────────────────────────
  const chatHeaderName = activeCharacter
    ? activeCharacter.name
    : activeConversation
      ? getOtherProfile(activeConversation)?.display_name || 'User'
      : '';

  const chatPartnerOnline = activeConversation && !activeCharacter
    ? isUserOnline(
        activeConversation.participant_1 === user?.id
          ? activeConversation.participant_2!
          : activeConversation.participant_1
      )
    : false;

  const chatHeaderSub = activeCharacter
    ? activeCharacter.role
    : chatPartnerOnline ? 'Online' : 'Offline';

  // ─── Render ───────────────────────────────────────────────
  return (
    <main className="flex h-screen bg-[#09090b] text-white overflow-hidden">

      {/* ══════════════ SIDEBAR ══════════════ */}
      <aside className={`${showSidebar ? 'flex' : 'hidden md:flex'} w-full md:w-[380px] flex-col border-r border-white/[0.06] bg-[#0f0f12]`}>

        {/* Sidebar header */}
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => router.push('/profile')} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 rounded-full bg-white/[0.08] overflow-hidden flex items-center justify-center">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <User className="w-5 h-5 text-white/40" />}
              </div>
              <div className="text-left">
                <p className="font-semibold text-sm">{profile?.display_name}</p>
                <p className="text-xs text-emerald-400">Online</p>
              </div>
            </button>
            <div className="flex items-center gap-1">
              <button onClick={() => router.push('/profile')} className="p-2 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white transition-colors" title="Edit profile">
                <Settings className="w-5 h-5" />
              </button>
              <button onClick={handleLogout} className="p-2 rounded-lg hover:bg-white/[0.06] text-white/40 hover:text-white transition-colors" title="Log out">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search people or characters..."
              className="w-full bg-white/[0.06] rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-500/30 placeholder:text-white/20"
            />
          </div>
        </div>

        {/* Sidebar body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">

          {/* AI Characters */}
          <div className="px-4 pt-4 pb-2">
            <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-3">AI Characters</p>
            <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
              {filteredCharacters.map((c) => (
                <button key={c.id} onClick={() => startCharacterConversation(c)}
                  className="flex flex-col items-center gap-1.5 min-w-[60px] group">
                  <div className={`w-12 h-12 rounded-full ${c.color} flex items-center justify-center text-lg shadow-lg group-hover:scale-110 transition-transform`}>
                    {c.avatar}
                  </div>
                  <span className="text-[10px] text-white/50 group-hover:text-white transition-colors truncate max-w-[60px]">{c.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-white/[0.06] mx-4" />

          {/* Recent Conversations */}
          {conversations.length > 0 && (
            <div className="px-2 pt-3">
              <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2 px-2">Recent Chats</p>
              {conversations.map((conv) => {
                const character   = getCharacterForConv(conv);
                const otherProf   = !character ? getOtherProfile(conv) : null;
                const name        = character ? character.name : otherProf?.display_name || 'User';
                const avatarUrl   = otherProf?.avatar_url;
                const online      = !character && otherProf ? isUserOnline(otherProf.id) : !!character;
                const isActive    = activeConversation?.id === conv.id;

                return (
                  <button key={conv.id}
                    onClick={() => openConversation(conv, character || null)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${isActive ? 'bg-emerald-500/10' : 'hover:bg-white/[0.04]'}`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-white/[0.08] overflow-hidden flex items-center justify-center">
                        {character
                          ? <span className="text-xl">{character.avatar}</span>
                          : avatarUrl
                            ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                            : <User className="w-5 h-5 text-white/30" />}
                      </div>
                      {online && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#0f0f12] flex items-center justify-center">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex justify-between items-baseline">
                        <p className="font-medium text-sm truncate">{name}</p>
                        <span className="text-[10px] text-white/20 flex-shrink-0 ml-2">
                          {conv.last_message_at ? formatDate(conv.last_message_at) : ''}
                        </span>
                      </div>
                      <p className="text-xs text-white/30 truncate mt-0.5">
                        {conv.last_message_text || (character ? character.motto : 'Start a conversation')}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div className="h-px bg-white/[0.06] mx-4 my-2" />

          {/* Online Users */}
          {onlineProfiles.length > 0 && (
            <div className="px-2 pt-2">
              <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2 px-2">
                Online Now <span className="text-emerald-400">({onlineProfiles.length})</span>
              </p>
              {onlineProfiles.map((p) => (
                <button key={p.id} onClick={() => startConversation(p.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors">
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-white/[0.08] overflow-hidden flex items-center justify-center">
                      {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-white/30" />}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#0f0f12] flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">{p.display_name}</p>
                    <p className="text-[10px] text-emerald-400">Online</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Past Conversations */}
          {pastConvProfiles.length > 0 && (
            <div className="px-2 pt-2">
              <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2 px-2">Past Conversations</p>
              {pastConvProfiles.map((p) => (
                <button key={p.id} onClick={() => startConversation(p.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors">
                  <div className="w-10 h-10 rounded-full bg-white/[0.08] overflow-hidden flex items-center justify-center flex-shrink-0">
                    {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-white/30" />}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">{p.display_name}</p>
                    <p className="text-[10px] text-white/20">Offline</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Discover People */}
          {otherProfiles.length > 0 && (
            <div className="px-2 pt-2 pb-4">
              <p className="text-xs font-semibold text-white/30 uppercase tracking-wider mb-2 px-2">Discover People</p>
              {otherProfiles.map((p) => (
                <button key={p.id} onClick={() => startConversation(p.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-colors">
                  <div className="w-10 h-10 rounded-full bg-white/[0.08] overflow-hidden flex items-center justify-center flex-shrink-0">
                    {p.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" /> : <User className="w-4 h-4 text-white/30" />}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium">{p.display_name}</p>
                    {p.bio && <p className="text-[10px] text-white/20 truncate max-w-[200px]">{p.bio}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>

      {/* ══════════════ CHAT AREA ══════════════ */}
      <div className={`${!showSidebar ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-w-0`}>
        {activeConversation ? (
          <>
            {/* Chat Header */}
            <div className="border-b border-white/[0.06] bg-[#0f0f12] flex-shrink-0">
              <div className="h-16 flex items-center justify-between px-4">
                <div className="flex items-center gap-3 min-w-0">
                  <button className="md:hidden p-1.5 rounded-lg hover:bg-white/[0.06] mr-1 flex-shrink-0"
                    onClick={() => setShowSidebar(true)}>
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => activeCharacter && setShowCharacterInfo(!showCharacterInfo)}
                    className="flex items-center gap-3 min-w-0"
                  >
                    <div className={`w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0 ${activeCharacter ? `bg-gradient-to-br ${activeCharacter.gradient}` : 'bg-white/[0.08]'}`}>
                      {activeCharacter
                        ? <span className="text-xl">{activeCharacter.avatar}</span>
                        : getOtherProfile(activeConversation)?.avatar_url
                          ? <img src={getOtherProfile(activeConversation)!.avatar_url} alt="" className="w-full h-full object-cover" />
                          : <User className="w-5 h-5 text-white/30" />}
                    </div>
                    <div className="text-left min-w-0">
                      <p className="font-semibold text-sm truncate">{chatHeaderName}</p>
                      <p className={`text-xs ${chatHeaderSub === 'Online' || activeCharacter ? 'text-emerald-400' : 'text-white/30'}`}>
                        {chatHeaderSub}
                      </p>
                    </div>
                  </button>
                </div>
                {activeCharacter && (
                  <div className="flex items-center gap-2">
                    {/* Live voice call button */}
                    <button
                      onClick={() => {
                        if (inLiveCall) voiceCall.endCall();
                        else voiceCall.startCall();
                      }}
                      disabled={voiceCall.status === 'connecting'}
                      title={inLiveCall ? 'End voice call' : 'Start live voice call'}
                      className={`relative flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all duration-200 select-none ${
                        inLiveCall
                          ? 'bg-red-500/15 border-red-400/40 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.15)]'
                          : voiceCall.status === 'connecting'
                            ? 'bg-amber-500/15 border-amber-400/40 text-amber-400'
                            : 'bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white/70 hover:bg-white/[0.07] hover:border-white/[0.12]'
                      }`}
                    >
                      {voiceCall.status === 'connecting'
                        ? <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
                        : inLiveCall
                          ? <PhoneOff className="w-4 h-4 flex-shrink-0" />
                          : <Phone className="w-4 h-4 flex-shrink-0" />}
                      <span className="hidden sm:inline">
                        {voiceCall.status === 'connecting' ? 'Connecting...' : inLiveCall ? 'End Call' : 'Call'}
                      </span>
                      {inLiveCall && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-400 border-2 border-[#0f0f12] animate-pulse" />
                      )}
                    </button>
                    {/* Voice mode toggle (text-triggered voice replies) */}
                    <button
                      onClick={() => setVoiceMode((v) => !v)}
                      title={voiceMode ? 'Switch to text replies' : 'Switch to voice replies'}
                      className={`relative flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all duration-200 select-none ${
                        voiceMode
                          ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.15)]'
                          : 'bg-white/[0.04] border-white/[0.08] text-white/40 hover:text-white/70 hover:bg-white/[0.07] hover:border-white/[0.12]'
                      }`}
                    >
                      <Headphones className="w-4 h-4 flex-shrink-0" />
                      <span className="hidden sm:inline">{voiceMode ? 'Voice On' : 'Voice'}</span>
                      {voiceMode && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0f0f12] animate-pulse" />
                      )}
                    </button>
                    <MusicPlayer mood={activeCharacter.musicMood} accentColor={activeCharacter.accentColor} />
                  </div>
                )}
              </div>

              {/* Character Info Panel */}
              <AnimatePresence>
                {showCharacterInfo && activeCharacter && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-white/[0.06]"
                  >
                    <div className="p-4 bg-white/[0.02]">
                      <div className="flex items-start gap-4">
                        <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${activeCharacter.gradient} flex items-center justify-center text-3xl shadow-lg flex-shrink-0`}>
                          {activeCharacter.avatar}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold">{activeCharacter.name}</h3>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40">{String(activeCharacter.age)}</span>
                          </div>
                          <p className="text-xs mb-2" style={{ color: activeCharacter.accentColor }}>{activeCharacter.role}</p>
                          <p className="text-xs text-white/40 leading-relaxed">{activeCharacter.bio}</p>
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {activeCharacter.nature.map((t) => (
                              <span key={t} className="text-[10px] px-2 py-0.5 rounded-full border border-white/[0.08] text-white/30">{t}</span>
                            ))}
                          </div>
                          <p className="text-[10px] text-white/20 mt-2 italic">&ldquo;{activeCharacter.motto}&rdquo;</p>
                        </div>
                        <button onClick={() => setShowCharacterInfo(false)} className="p-1 rounded-lg hover:bg-white/[0.06] text-white/30 flex-shrink-0">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ══════════════ LIVE VOICE CALL OVERLAY ══════════════ */}
            <AnimatePresence>
              {inLiveCall && activeCharacter && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex-1 flex flex-col items-center justify-center bg-gradient-to-b from-[#09090b] via-[#0a0a0f] to-[#09090b] relative overflow-hidden"
                >
                  {/* Background glow */}
                  <div
                    className="absolute inset-0 opacity-10"
                    style={{
                      background: `radial-gradient(circle at 50% 40%, ${activeCharacter.accentColor}40, transparent 70%)`,
                    }}
                  />

                  {/* Content */}
                  <div className="relative z-10 flex flex-col items-center gap-6">
                    {/* Character avatar with speaking ring */}
                    <div className="relative">
                      {/* Outer speaking ring */}
                      <div
                        className={`absolute -inset-3 rounded-full transition-all duration-300 ${
                          voiceCall.aiSpeaking
                            ? 'opacity-100 scale-100 animate-[spin_3s_linear_infinite]'
                            : 'opacity-0 scale-95'
                        }`}
                        style={{
                          background: `conic-gradient(from 0deg, ${activeCharacter.accentColor}60, transparent, ${activeCharacter.accentColor}60)`,
                        }}
                      />
                      <div
                        className={`absolute -inset-2 rounded-full transition-all duration-300 ${
                          voiceCall.aiSpeaking ? 'opacity-60' : 'opacity-0'
                        }`}
                        style={{
                          boxShadow: `0 0 30px ${activeCharacter.accentColor}40, 0 0 60px ${activeCharacter.accentColor}20`,
                        }}
                      />
                      <div className={`relative w-28 h-28 rounded-full bg-gradient-to-br ${activeCharacter.gradient} flex items-center justify-center text-5xl shadow-2xl`}>
                        {activeCharacter.avatar}
                      </div>
                      {/* AI speaking waveform */}
                      {voiceCall.aiSpeaking && (
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-end gap-[3px]">
                          {[5, 8, 12, 10, 14, 10, 12, 8, 5].map((h, i) => (
                            <div
                              key={i}
                              className="w-[3px] rounded-full"
                              style={{
                                backgroundColor: activeCharacter.accentColor,
                                height: `${h}px`,
                                animation: 'pulse 0.6s ease-in-out infinite',
                                animationDelay: `${i * 70}ms`,
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Character name */}
                    <div className="text-center">
                      <h2 className="text-xl font-bold">{activeCharacter.name}</h2>
                      <p className="text-sm mt-1" style={{ color: activeCharacter.accentColor }}>
                        {voiceCall.aiSpeaking ? 'Speaking...' : voiceCall.userSpeaking ? 'Listening...' : 'In call'}
                      </p>
                    </div>

                    {/* Call duration */}
                    <p className="text-sm text-white/30 font-mono tabular-nums">
                      {Math.floor(voiceCall.callDuration / 60).toString().padStart(2, '0')}
                      :{(voiceCall.callDuration % 60).toString().padStart(2, '0')}
                    </p>

                    {/* User speaking indicator */}
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all duration-200 ${
                      voiceCall.userSpeaking
                        ? 'bg-emerald-500/15 border border-emerald-400/30'
                        : 'bg-white/[0.04] border border-white/[0.06]'
                    }`}>
                      <Mic className={`w-4 h-4 ${voiceCall.userSpeaking ? 'text-emerald-400' : 'text-white/30'}`} />
                      <span className={`text-xs font-medium ${voiceCall.userSpeaking ? 'text-emerald-400' : 'text-white/30'}`}>
                        {voiceCall.isMuted ? 'Muted' : voiceCall.userSpeaking ? 'You\'re speaking' : 'Speak to chat'}
                      </span>
                      {voiceCall.userSpeaking && !voiceCall.isMuted && (
                        <div className="flex items-end gap-[2px]">
                          {[4, 7, 5, 8, 4].map((h, i) => (
                            <div
                              key={i}
                              className="w-[2px] rounded-full bg-emerald-400 animate-pulse"
                              style={{ height: `${h}px`, animationDelay: `${i * 80}ms`, animationDuration: '0.5s' }}
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Call controls */}
                    <div className="flex items-center gap-5 mt-4">
                      {/* Mute toggle */}
                      <button
                        onClick={voiceCall.toggleMute}
                        className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-200 active:scale-95 ${
                          voiceCall.isMuted
                            ? 'bg-white/[0.15] text-white'
                            : 'bg-white/[0.06] text-white/50 hover:bg-white/[0.1] hover:text-white'
                        }`}
                        title={voiceCall.isMuted ? 'Unmute' : 'Mute'}
                      >
                        {voiceCall.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                      </button>

                      {/* End call */}
                      <button
                        onClick={voiceCall.endCall}
                        className="w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-400 transition-all duration-200 active:scale-95 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                        title="End call"
                      >
                        <PhoneOff className="w-7 h-7" />
                      </button>

                      {/* Speaker (placeholder) */}
                      <button
                        className="w-14 h-14 rounded-full bg-white/[0.06] text-white/50 flex items-center justify-center hover:bg-white/[0.1] hover:text-white transition-all duration-200 active:scale-95"
                        title="Speaker"
                      >
                        <Volume2 className="w-6 h-6" />
                      </button>
                    </div>

                    {/* Error message */}
                    {voiceCall.error && (
                      <p className="text-xs text-red-400 mt-2">{voiceCall.error}</p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages */}
            <div
              ref={scrollRef}
              className={`flex-1 overflow-y-auto px-4 md:px-16 py-6 space-y-1 custom-scrollbar bg-[#09090b] ${inLiveCall ? 'hidden' : ''}`}
            >
              {messages.length === 0 && !sending && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-4 ${activeCharacter ? `bg-gradient-to-br ${activeCharacter.gradient}` : 'bg-white/[0.06]'}`}>
                    {activeCharacter
                      ? <span className="text-4xl">{activeCharacter.avatar}</span>
                      : <MessageCircle className="w-8 h-8 text-white/20" />}
                  </div>
                  <p className="font-semibold text-lg mb-1">
                    {activeCharacter ? activeCharacter.name : 'Start chatting'}
                  </p>
                  <p className="text-white/30 text-sm max-w-xs">
                    {activeCharacter ? activeCharacter.motto : 'Send a message to start the conversation.'}
                  </p>
                  {activeCharacter && (
                    <p className="text-white/20 text-xs mt-2 max-w-sm">{activeCharacter.bio.slice(0, 100)}...</p>
                  )}
                </div>
              )}

              <AnimatePresence initial={false}>
                {messages.map((m, idx) => {
                  const fromMe = m.role === 'user' && m.sender_id === user?.id;
                  const isTemp = m.id.startsWith('temp-');

                  const showDateSep = idx === 0 || (
                    new Date(messages[idx - 1].created_at).toDateString() !==
                    new Date(m.created_at).toDateString()
                  );

                  return (
                    <React.Fragment key={m.id}>
                      {showDateSep && (
                        <div className="flex justify-center my-4">
                          <span className="bg-white/[0.06] text-white/30 text-[10px] font-medium px-3 py-1 rounded-lg">
                            {formatDate(m.created_at)}
                          </span>
                        </div>
                      )}
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: isTemp ? 0.7 : 1, y: 0 }}
                        transition={{ duration: 0.15 }}
                        className={`flex ${fromMe ? 'justify-end' : 'justify-start'} mb-1`}
                      >
                        <div className="max-w-[75%] md:max-w-[60%]">
                          <div className={`rounded-2xl overflow-hidden ${
                            fromMe
                              ? 'bg-emerald-600 rounded-tr-md'
                              : 'bg-white/[0.08] rounded-tl-md'
                          } ${m.message_type === 'image' ? 'p-0' : 'px-3.5 py-2.5'}`}>

                            {/* Image */}
                            {m.message_type === 'image' && m.media_url && (
                              <div className="relative group">
                                <img
                                  src={m.media_url}
                                  alt="Shared image"
                                  className="block max-w-full max-h-72 object-cover rounded-2xl"
                                  loading="lazy"
                                />
                                <a
                                  href={m.media_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="absolute inset-0 flex items-end justify-end p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <span className="bg-black/60 backdrop-blur-sm rounded-lg p-1.5">
                                    <ExternalLink className="w-3.5 h-3.5 text-white" />
                                  </span>
                                </a>
                                {/* Timestamp overlay on image */}
                                <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm rounded-md px-1.5 py-0.5">
                                  <span className="text-[10px] text-white/80">{formatTime(m.created_at)}</span>
                                  {fromMe && (isTemp
                                    ? <Loader2 className="w-3 h-3 text-white/60 animate-spin" />
                                    : <CheckCheck className="w-3.5 h-3.5 text-white/60" />)}
                                </div>
                              </div>
                            )}

                            {/* Video */}
                            {m.message_type === 'video' && m.media_url && (
                              <div className="rounded-xl overflow-hidden bg-black mb-1.5">
                                <video
                                  src={m.media_url}
                                  controls
                                  className="max-w-full max-h-64 block"
                                  preload="metadata"
                                />
                              </div>
                            )}

                            {/* Audio (voice message) */}
                            {m.message_type === 'audio' && m.media_url && (
                              <div className="mb-1">
                                <AudioPlayer
                                  src={m.media_url}
                                  isOwn={fromMe}
                                  accentColor={activeCharacter?.accentColor}
                                />
                              </div>
                            )}

                            {/* Document */}
                            {m.message_type === 'document' && m.media_url && (
                              <a
                                href={m.media_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`flex items-center gap-3 p-2.5 rounded-xl mb-1.5 transition-colors ${
                                  fromMe ? 'bg-white/[0.12] hover:bg-white/[0.2]' : 'bg-white/[0.06] hover:bg-white/[0.1]'
                                }`}
                              >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${fromMe ? 'bg-white/[0.15]' : 'bg-emerald-500/15'}`}>
                                  <FileText className={`w-5 h-5 ${fromMe ? 'text-white/80' : 'text-emerald-400'}`} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium truncate">{m.media_name || 'Document'}</p>
                                  {m.media_size && (
                                    <p className={`text-[10px] mt-0.5 ${fromMe ? 'text-white/50' : 'text-white/30'}`}>
                                      {m.media_size > 1024 * 1024
                                        ? `${(m.media_size / (1024 * 1024)).toFixed(1)} MB`
                                        : `${(m.media_size / 1024).toFixed(0)} KB`}
                                    </p>
                                  )}
                                </div>
                                <Download className={`w-4 h-4 flex-shrink-0 ${fromMe ? 'text-white/50' : 'text-white/30'}`} />
                              </a>
                            )}

                            {/* Text content */}
                            {m.content && m.message_type !== 'image' && (
                              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.content}</p>
                            )}

                            {/* Timestamp — skip for image (overlaid above) */}
                            {m.message_type !== 'image' && (
                              <div className={`flex items-center gap-1 mt-1 ${fromMe ? 'justify-end' : 'justify-start'}`}>
                                <span className="text-[10px] text-white/20">{formatTime(m.created_at)}</span>
                                {fromMe && (
                                  isTemp
                                    ? <Loader2 className="w-3 h-3 text-white/20 animate-spin" />
                                    : <CheckCheck className="w-3.5 h-3.5 text-white/30" />
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    </React.Fragment>
                  );
                })}
              </AnimatePresence>

              {/* AI typing / generating voice indicator */}
              <AnimatePresence>
                {(sending || generatingVoice) && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.2 }}
                    className="flex justify-start mb-2"
                  >
                    <div className="flex items-center gap-3 bg-white/[0.06] border border-white/[0.06] rounded-2xl rounded-tl-md px-4 py-3">
                      {/* Avatar */}
                      {activeCharacter && (
                        <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${activeCharacter.gradient} flex items-center justify-center text-sm flex-shrink-0`}>
                          {activeCharacter.avatar}
                        </div>
                      )}
                      {generatingVoice ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-end gap-[3px]">
                            {[6, 10, 8, 12, 7, 10, 6].map((h, i) => (
                              <div
                                key={i}
                                className="w-[3px] rounded-full"
                                style={{
                                  backgroundColor: activeCharacter?.accentColor || '#10b981',
                                  height: `${h}px`,
                                  animation: 'pulse 0.7s ease-in-out infinite',
                                  animationDelay: `${i * 80}ms`,
                                }}
                              />
                            ))}
                          </div>
                          <span className="text-[11px] text-white/40 font-medium">
                            {activeCharacter?.name} is speaking...
                          </span>
                        </div>
                      ) : (
                        <div className="flex gap-[5px] items-center">
                          {[0, 150, 300].map((delay) => (
                            <div
                              key={delay}
                              className="w-2 h-2 rounded-full bg-white/40 animate-bounce"
                              style={{ animationDelay: `${delay}ms`, animationDuration: '1s' }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Input — hidden during live voice call */}
            <div className={`border-t border-white/[0.06] bg-[#0f0f12] flex-shrink-0 ${inLiveCall ? 'hidden' : ''}`}>

              {/* Status banners */}
              <AnimatePresence>
                {recording && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-3 px-4 py-2 bg-red-500/10 border-b border-red-500/20">
                      {/* Animated recording dot */}
                      <div className="relative flex-shrink-0">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                        <div className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-60" />
                      </div>
                      <div className="flex items-end gap-[2px] flex-shrink-0">
                        {[5, 8, 6, 10, 7].map((h, i) => (
                          <div
                            key={i}
                            className="w-[2px] rounded-full bg-red-400 animate-pulse"
                            style={{ height: `${h}px`, animationDelay: `${i * 100}ms`, animationDuration: '0.6s' }}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-red-400 font-medium flex-1">Recording... release mic to send</span>
                      <button
                        type="button"
                        onClick={stopRecording}
                        className="text-xs text-red-400/70 hover:text-red-400 underline transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
                {uploading && !recording && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="overflow-hidden"
                  >
                    <div className="flex items-center gap-2 px-4 py-1.5 bg-white/[0.03] border-b border-white/[0.04]">
                      <Loader2 className="w-3 h-3 animate-spin text-white/30" />
                      <span className="text-xs text-white/30">Uploading file...</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="p-3">
                <form onSubmit={sendMessage} className="flex items-center gap-2">
                  {/* Attach file */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={recording}
                    className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-white/[0.06] text-white/40 hover:text-white/70 disabled:opacity-30 transition-colors flex-shrink-0"
                    title="Attach file (image, video, audio, document)"
                  >
                    <Paperclip className="w-5 h-5" />
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  {/* Text input */}
                  <div className="relative flex-1">
                    <input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage(e as any);
                        }
                      }}
                      placeholder={
                        recording
                          ? '🎙 Recording...'
                          : voiceMode && activeCharacter
                            ? `Message ${activeCharacter.name} (voice reply)`
                            : 'Type a message...'
                      }
                      disabled={recording}
                      className="w-full bg-white/[0.06] border border-white/[0.08] rounded-xl pl-4 pr-4 py-3 text-sm focus:outline-none focus:border-emerald-500/30 focus:bg-white/[0.08] transition-all placeholder:text-white/20 disabled:opacity-50"
                    />
                    {voiceMode && activeCharacter && !recording && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      </div>
                    )}
                  </div>

                  {/* Mic button — only show for AI chats */}
                  {activeCharacter && (
                    <div className="relative flex-shrink-0">
                      {/* Pulse ring while recording */}
                      {recording && (
                        <span className="absolute inset-0 rounded-xl bg-red-500 animate-ping opacity-30 pointer-events-none" />
                      )}
                      <button
                        type="button"
                        onMouseDown={startRecording}
                        onMouseUp={stopRecording}
                        onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                        onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
                        aria-label={recording ? 'Release to send voice message' : 'Hold to record voice message'}
                        title={recording ? 'Release to send voice message' : 'Hold to record voice message'}
                        className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-150 active:scale-95 ${
                          recording
                            ? 'bg-red-500 text-white shadow-[0_0_16px_rgba(239,68,68,0.4)]'
                            : 'bg-white/[0.06] text-white/50 hover:text-white hover:bg-white/[0.1] border border-white/[0.08] hover:border-white/[0.15]'
                        }`}
                      >
                        {recording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                      </button>
                    </div>
                  )}

                  {/* Send button */}
                  <button
                    type="submit"
                    disabled={!newMessage.trim() || sending || generatingVoice || recording}
                    aria-label="Send message"
                    className="w-11 h-11 flex items-center justify-center rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 active:scale-95 flex-shrink-0 shadow-[0_2px_8px_rgba(52,211,153,0.2)]"
                  >
                    {sending || generatingVoice
                      ? <Loader2 className="w-5 h-5 animate-spin" />
                      : <Send className="w-4.5 h-4.5" />}
                  </button>
                </form>
              </div>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center bg-[#09090b]">
            <div className="w-20 h-20 rounded-3xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-6">
              <MessageCircle className="w-10 h-10 text-white/10" />
            </div>
            <h2 className="text-xl font-semibold text-white/30 mb-2">Your messages</h2>
            <p className="text-sm text-white/20 max-w-sm text-center mb-6">
              Select a conversation, pick an AI character, or click on a user to start chatting.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              {AI_CHARACTERS.slice(0, 3).map((c) => (
                <button key={c.id} onClick={() => startCharacterConversation(c)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-colors">
                  <span className="text-lg">{c.avatar}</span>
                  <span className="text-sm text-white/50">Chat with {c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
