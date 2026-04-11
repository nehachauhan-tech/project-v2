'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Search, LogOut, User,
  Paperclip, FileText,
  MessageCircle, ArrowLeft, Loader2, CheckCheck,
  X, Volume2, VolumeX, Settings,
} from 'lucide-react';
import { supabase_client } from '@/lib/supabase_client';
import { useRouter } from 'next/navigation';
import { AI_CHARACTERS, CHARACTER_MAP, type AICharacter } from '@/data/characters';
import type { Profile, Conversation, Message, OnlineUser, MessageType } from '@/types';

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

  const scrollRef           = useRef<HTMLDivElement>(null);
  const fileInputRef        = useRef<HTMLInputElement>(null);
  const router              = useRouter();

  // Stable refs — let realtime callbacks always see current values without stale closures
  const userRef             = useRef<any>(null);
  const activeConvRef       = useRef<Conversation | null>(null);
  const msgSubRef           = useRef<any>(null);   // current messages subscription

  userRef.current         = user;
  activeConvRef.current   = activeConversation;

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
  const subscribeToMessages = useCallback((conversationId: string) => {
    // Remove old subscription cleanly
    if (msgSubRef.current) {
      supabase_client.removeChannel(msgSubRef.current);
      msgSubRef.current = null;
    }

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
          // Replace matching optimistic temp message or deduplicate
          const hasTemp = prev.some(
            (m) => m.id.startsWith('temp-') &&
                   m.sender_id === incoming.sender_id &&
                   m.content === incoming.content &&
                   m.role === incoming.role
          );
          if (hasTemp) {
            return prev.map((m) =>
              m.id.startsWith('temp-') &&
              m.sender_id === incoming.sender_id &&
              m.content === incoming.content &&
              m.role === incoming.role
                ? incoming
                : m
            );
          }
          if (prev.some((m) => m.id === incoming.id)) return prev;
          return [...prev, incoming];
        });
      })
      .subscribe((status) => {
        // If subscription fails, fall back to a full fetch
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          fetchMessages(conversationId);
        }
      });

    msgSubRef.current = channel;
  }, [fetchMessages]);

  // ─── Auth + Init ─────────────────────────────────────────
  useEffect(() => {
    let presenceChannel: any  = null;
    let convChannel: any      = null;
    let authSub: any          = null;
    let mounted               = true;

    const bootstrap = async () => {
      try {
        // Use getSession (local cache) — avoids network failure on init
        const { data: { session } } = await supabase_client.auth.getSession();

        if (!session?.user) {
          router.replace('/login');
          return;
        }

        const currentUser = session.user;

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

  // ─── Switch active conversation ───────────────────────────
  // When user taps a conversation in sidebar: load messages + subscribe
  const openConversation = useCallback((conv: Conversation, character: AICharacter | null) => {
    setActiveConversation(conv);
    setActiveCharacter(character);
    setShowSidebar(false);
    setShowCharacterInfo(false);
    setMessages([]); // Clear immediately so old messages don't flash

    // Load messages and start realtime subscription
    fetchMessages(conv.id);
    subscribeToMessages(conv.id);
  }, [fetchMessages, subscribeToMessages]);

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
    const { error: insertErr } = await supabase_client
      .from('project_v2_messages')
      .insert({
        conversation_id: activeConversation.id,
        sender_id: user.id,
        role: 'user',
        content,
        message_type: 'text',
      });

    if (insertErr) {
      console.error('Message insert error:', insertErr);
      // Roll back optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      return;
    }

    // AI response
    if (activeCharacter) {
      setSending(true);
      try {
        const history = messages
          .filter((m) => !m.id.startsWith('temp-'))
          .slice(-100)
          .map((m) => ({ role: m.role, content: m.content }));

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
            sender_id: user.id,
            role: 'assistant',
            content: data.response,
            message_type: 'text',
          });
        }
      } catch (err) {
        console.error('AI error:', err);
      } finally {
        setSending(false);
      }
    }
  };

  // ─── File Upload ──────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation || !user) return;
    if (file.size > 50 * 1024 * 1024) { alert('File must be under 50MB.'); return; }

    setUploading(true);
    const msgType = getMessageType(file);
    const ext = file.name.split('.').pop();
    const filePath = `${user.id}/${activeConversation.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase_client.storage
      .from('project-v2-media').upload(filePath, file);
    if (uploadError) { console.error('Upload error:', uploadError); setUploading(false); return; }

    const { data: urlData } = supabase_client.storage
      .from('project-v2-media').getPublicUrl(filePath);

    await supabase_client.from('project_v2_messages').insert({
      conversation_id: activeConversation.id,
      sender_id: user.id,
      role: 'user',
      content: '',
      message_type: msgType,
      media_url: urlData.publicUrl,
      media_name: file.name,
      media_size: file.size,
    });

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
                  <MusicPlayer mood={activeCharacter.musicMood} accentColor={activeCharacter.accentColor} />
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

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 md:px-16 py-6 space-y-1 custom-scrollbar bg-[#09090b]"
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
                          <div className={`px-3.5 py-2 rounded-2xl ${fromMe ? 'bg-emerald-600 rounded-tr-md' : 'bg-white/[0.08] rounded-tl-md'}`}>
                            {m.message_type === 'image' && m.media_url && (
                              <img src={m.media_url} alt="Shared image" className="rounded-xl max-w-full max-h-64 object-cover mb-1" />
                            )}
                            {m.message_type === 'video' && m.media_url && (
                              <video src={m.media_url} controls className="rounded-xl max-w-full max-h-64 mb-1" />
                            )}
                            {m.message_type === 'audio' && m.media_url && (
                              <audio src={m.media_url} controls className="max-w-full mb-1" />
                            )}
                            {m.message_type === 'document' && m.media_url && (
                              <a href={m.media_url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] transition-colors mb-1">
                                <FileText className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{m.media_name || 'Document'}</p>
                                  {m.media_size && <p className="text-[10px] text-white/30">{(m.media_size / 1024).toFixed(0)} KB</p>}
                                </div>
                              </a>
                            )}
                            {m.content && (
                              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{m.content}</p>
                            )}
                            <div className={`flex items-center gap-1 mt-1 ${fromMe ? 'justify-end' : 'justify-start'}`}>
                              <span className="text-[10px] text-white/20">{formatTime(m.created_at)}</span>
                              {fromMe && (
                                isTemp
                                  ? <Loader2 className="w-3 h-3 text-white/20 animate-spin" />
                                  : <CheckCheck className="w-3.5 h-3.5 text-white/30" />
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </React.Fragment>
                  );
                })}
              </AnimatePresence>

              {/* AI typing indicator */}
              {sending && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start mb-1"
                >
                  <div className="bg-white/[0.08] rounded-2xl rounded-tl-md px-4 py-3">
                    <div className="flex gap-1.5 items-center">
                      <div className="w-2 h-2 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-white/[0.06] bg-[#0f0f12] flex-shrink-0">
              {uploading && (
                <div className="flex items-center gap-2 text-xs text-white/40 mb-2 px-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading file...
                </div>
              )}
              <form onSubmit={sendMessage} className="flex items-center gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 rounded-xl hover:bg-white/[0.06] text-white/40 hover:text-white transition-colors flex-shrink-0"
                  title="Attach file">
                  <Paperclip className="w-5 h-5" />
                </button>
                <input ref={fileInputRef} type="file"
                  accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                  onChange={handleFileUpload} className="hidden" />
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage(e as any);
                    }
                  }}
                  placeholder="Type a message"
                  className="flex-1 bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-emerald-500/30 transition-colors placeholder:text-white/20"
                />
                <button type="submit" disabled={!newMessage.trim() || sending}
                  className="p-2.5 rounded-xl bg-emerald-500 text-black hover:bg-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0">
                  <Send className="w-5 h-5" />
                </button>
              </form>
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
