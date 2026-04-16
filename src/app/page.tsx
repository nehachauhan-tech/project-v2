'use client';

import React, { useEffect, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import {
  MessageCircle, Shield, Bot, Users, Sparkles, ArrowRight,
  Zap, Globe, Image, FileText, Mic, Video, User
} from 'lucide-react';
import { supabase_client } from '@/lib/supabase_client';
import { AI_CHARACTERS } from '@/data/characters';

const FEATURES = [
  {
    icon: Shield,
    title: 'Fully Anonymous',
    desc: 'No phone number, no social login. Just pick a name and start chatting. Your identity stays yours.',
  },
  {
    icon: Bot,
    title: 'AI Roleplay Characters',
    desc: 'Chat with unique AI personas, each with their own personality, backstory, and conversation style.',
  },
  {
    icon: Users,
    title: 'Real People, Real Time',
    desc: 'Connect with other anonymous users who are online right now. Text, share media, and more.',
  },
  {
    icon: Globe,
    title: 'Rich Media Sharing',
    desc: 'Send images, audio, video, and documents. Full media support for expressive conversations.',
  },
];

const MEDIA_TYPES = [
  { icon: Image, label: 'Photos', color: 'text-blue-400' },
  { icon: Video, label: 'Videos', color: 'text-rose-400' },
  { icon: Mic, label: 'Audio', color: 'text-amber-400' },
  { icon: FileText, label: 'Documents', color: 'text-emerald-400' },
];

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [userProfile, setUserProfile] = useState<{ id: string; avatar_url?: string; display_name?: string } | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.15], [1, 0.95]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);

    const checkAuth = async () => {
      try {
        // Use getSession() for instant local check (no network), then fetch profile
        const { data: { session } } = await supabase_client.auth.getSession();
        if (session?.user) {
          const { data: profile } = await supabase_client
            .from('project_v2_profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          setUserProfile(profile || { id: session.user.id });
        }
      } catch (err) {
        console.error('Error checking auth:', err);
      } finally {
        setLoadingAuth(false);
      }
    };
    checkAuth();

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <main className="relative min-h-screen bg-[#09090b] text-white">
      {/* Gradient Background Orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-500/[0.07] blur-[128px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-purple-500/[0.05] blur-[128px]" />
        <div className="absolute top-[40%] right-[20%] w-[300px] h-[300px] rounded-full bg-cyan-500/[0.04] blur-[100px]" />
      </div>

      {/* Navigation */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${scrolled ? 'py-3 bg-[#09090b]/80 backdrop-blur-xl border-b border-white/[0.06]' : 'py-5'}`}>
        <div className="max-w-6xl mx-auto px-6 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-black" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold tracking-tight">Hirecheck</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {['Features', 'Characters', 'How it works'].map((item) => (
              <a key={item} href={`#${item.toLowerCase().replace(/\s+/g, '-')}`} className="text-sm text-white/50 hover:text-white transition-colors">
                {item}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {!loadingAuth && userProfile ? (
              <>
                <Link href="/chat" className="text-sm text-white/60 hover:text-white transition-colors px-4 py-2 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" /> Start chatting
                </Link>
                <Link href="/chat" className="w-10 h-10 rounded-full bg-white/[0.08] flex items-center justify-center overflow-hidden hover:opacity-80 transition-opacity border border-white/[0.05]">
                  {userProfile.avatar_url ? (
                    <img src={userProfile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-white/40" />
                  )}
                </Link>
              </>
            ) : !loadingAuth ? (
              <>
                <Link href="/login" className="text-sm text-white/60 hover:text-white transition-colors px-4 py-2">
                  Log in
                </Link>
                <Link href="/signup" className="btn-primary text-sm !px-5 !py-2.5 flex items-center gap-2">
                  Get Started <ArrowRight className="w-4 h-4" />
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </nav>

      <div className="relative z-10">
        {/* Hero */}
        <section className="relative min-h-screen flex flex-col items-center justify-center px-6 pt-20">
          <motion.div
            style={{ opacity: heroOpacity, scale: heroScale }}
            className="text-center max-w-4xl mx-auto"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-8"
            >
              <Sparkles className="w-4 h-4" />
              Anonymous chat with AI & real people
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              className="text-5xl md:text-7xl lg:text-8xl font-extrabold tracking-tight leading-[0.95] mb-6"
            >
              Talk to{' '}
              <span className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                Anyone
              </span>
              <br />
              Be{' '}
              <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                Anonymous
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              Chat with AI roleplay characters who feel real, or connect with anonymous
              strangers online. Share text, images, audio, video, and documents &mdash; completely private.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              <Link href="/signup" className="btn-primary text-base !px-8 !py-4 flex items-center gap-3 shadow-lg shadow-emerald-500/20">
                Start Chatting Free <ArrowRight className="w-5 h-5" />
              </Link>
              <a href="#characters" className="btn-secondary text-base !px-8 !py-4 flex items-center gap-3">
                <Bot className="w-5 h-5" /> Meet the Characters
              </a>
            </motion.div>

            {/* Media type pills */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="flex items-center justify-center gap-6 mt-12"
            >
              {MEDIA_TYPES.map((m) => (
                <div key={m.label} className="flex items-center gap-2 text-white/30 text-sm">
                  <m.icon className={`w-4 h-4 ${m.color}`} />
                  {m.label}
                </div>
              ))}
            </motion.div>
          </motion.div>

          {/* Chat Preview Mockup */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1, delay: 0.6 }}
            className="mt-16 w-full max-w-2xl mx-auto"
          >
            <div className="glass rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b border-white/[0.06]">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-lg">👩‍🎨</div>
                <div>
                  <p className="font-semibold text-sm">Sara</p>
                  <p className="text-xs text-emerald-400">Online</p>
                </div>
              </div>
              {/* Mock messages */}
              <div className="space-y-3">
                <div className="flex justify-start">
                  <div className="bg-white/[0.08] rounded-2xl rounded-tl-md px-4 py-3 max-w-[80%]">
                    <p className="text-sm text-white/80">Heyy! kaise ho? 😊 btw aaj mera internship ka first day tha, so exciting yaar!</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-2xl rounded-tr-md px-4 py-3 max-w-[80%]">
                    <p className="text-sm text-white/90">That sounds amazing! What kind of design work are you doing there?</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-white/[0.08] rounded-2xl rounded-tl-md px-4 py-3 max-w-[80%]">
                    <p className="text-sm text-white/80">UI illustrations mostly! lowkey nervous tha but team bohot chill hai haha. Tum batao, what&apos;s up with you? 🎨</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <div className="flex-1 bg-white/[0.06] rounded-xl px-4 py-3 text-sm text-white/30">Type a message...</div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                  <ArrowRight className="w-5 h-5 text-black" />
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Features */}
        <section id="features" className="py-32 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                Why{' '}
                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  Hirecheck
                </span>
              </h2>
              <p className="text-white/40 text-lg max-w-lg mx-auto">
                Everything you need for meaningful anonymous conversations.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {FEATURES.map((f, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="glass rounded-2xl p-8 hover:bg-white/[0.08] transition-colors group"
                >
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5 group-hover:bg-emerald-500/20 transition-colors">
                    <f.icon className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{f.title}</h3>
                  <p className="text-white/40 leading-relaxed">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* AI Characters */}
        <section id="characters" className="py-32 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                Meet the{' '}
                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Characters
                </span>
              </h2>
              <p className="text-white/40 text-lg max-w-lg mx-auto">
                AI personas with distinct personalities. Each one feels alive.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {AI_CHARACTERS.map((c, i) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ y: -8 }}
                  className="glass rounded-2xl p-6 hover:bg-white/[0.08] transition-all cursor-default"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${c.gradient} overflow-hidden flex items-center justify-center text-2xl shadow-lg flex-shrink-0`}>
                      {c.image
                        ? <img src={c.image} alt={c.name} className="w-full h-full object-cover" />
                        : c.avatar}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">{c.name}</h3>
                      <p className="text-xs font-medium" style={{ color: c.accentColor }}>{c.role}</p>
                    </div>
                  </div>
                  <p className="text-sm text-white/40 leading-relaxed mb-3">{c.bio.length > 120 ? c.bio.slice(0, 120) + '...' : c.bio}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {c.nature.slice(0, 3).map((trait) => (
                      <span key={trait} className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-white/40">{trait}</span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How it Works */}
        <section id="how-it-works" className="py-32 px-6">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                How it{' '}
                <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
                  Works
                </span>
              </h2>
            </motion.div>

            <div className="space-y-8">
              {[
                { step: '01', title: 'Create an Account', desc: 'Sign up with email and verify. Set up a quick profile with your display name and avatar.' },
                { step: '02', title: 'Pick a Conversation', desc: 'Choose an AI character to roleplay with, or find an anonymous user who\'s online right now.' },
                { step: '03', title: 'Start Talking', desc: 'Send text messages, photos, audio, video, or documents. It\'s a full chat experience, completely anonymous.' },
              ].map((s, i) => (
                <motion.div
                  key={s.step}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="flex gap-6 items-start"
                >
                  <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <span className="text-emerald-400 font-bold text-lg">{s.step}</span>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2">{s.title}</h3>
                    <p className="text-white/40 leading-relaxed">{s.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-32 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="glass-strong rounded-3xl p-12 md:p-16"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-500 flex items-center justify-center mx-auto mb-6">
                <Zap className="w-8 h-8 text-black" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to start talking?</h2>
              <p className="text-white/40 text-lg mb-8 max-w-md mx-auto">
                Join thousands of anonymous users and AI characters. Free, private, and always online.
              </p>
              <Link href="/signup" className="btn-primary text-base !px-10 !py-4 inline-flex items-center gap-3 shadow-lg shadow-emerald-500/20">
                Create Free Account <ArrowRight className="w-5 h-5" />
              </Link>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-6 border-t border-white/[0.06]">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-black" strokeWidth={2.5} />
              </div>
              <span className="font-bold">Hirecheck</span>
            </div>
            <p className="text-sm text-white/30">&copy; 2026 Hirecheck. All rights reserved.</p>
            <div className="flex gap-6 text-sm text-white/30">
              <a href="#" className="hover:text-white/60 transition-colors">Privacy</a>
              <a href="#" className="hover:text-white/60 transition-colors">Terms</a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
