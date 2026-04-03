'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { FiArrowRight, FiShield, FiCpu, FiGlobe, FiLayers, FiZap, FiChevronRight } from 'react-icons/fi';
import VariationSwitcher from '@/components/VariationSwitcher';

// Dynamic import for 3D scene to optimize first paint
const ThreeScene = dynamic(() => import('@/components/ThreeScene'), { 
  ssr: false,
  loading: () => <div className="fixed inset-0 bg-[#0a0a0a]" />
});

type ThemeType = 'nebula' | 'cyber' | 'flow' | 'retro' | 'aurora' | 'royal';

const PERSONAS = [
  { id: 1, name: 'Nova', role: 'Cyber Explorer', desc: 'A wanderer from the digital frontier, seeking connection in the void.', color: 'from-purple-500 to-pink-500' },
  { id: 2, name: 'Axel', role: 'Neural Architect', desc: 'He builds the worlds you dream of. Silent, focused, and profoundly deep.', color: 'from-cyan-500 to-blue-500' },
  { id: 3, name: 'Lyra', role: 'Echo Singer', desc: 'Her voice is a resonance that vibrates through the quantum layers.', color: 'from-amber-400 to-orange-600' },
  { id: 4, name: 'Zenith', role: 'Void Guardian', desc: 'Guardian of the boundary between the real and the simulated.', color: 'from-emerald-400 to-teal-600' },
  { id: 5, name: 'Pulse', role: 'Neon Runner', desc: 'The heartbeat of the neon city, always one step ahead of the grid.', color: 'from-red-500 to-orange-400' },
  { id: 6, name: 'Aura', role: 'Light Weaver', desc: 'She weaves emotions into visible spectral patterns. A beacon.', color: 'from-indigo-400 to-purple-600' },
];

const THEMES: { id: ThemeType; name: string; desc: string; preview: string; color: string }[] = [
  { id: 'nebula', name: 'Nebula', desc: 'Deep Space', preview: 'dimension-nebula', color: '#9333ea' },
  { id: 'cyber', name: 'Cyber', desc: 'Neon Glitch', preview: 'dimension-cyber', color: '#06b6d4' },
  { id: 'flow', name: 'Flow', desc: 'Liquid Chrome', preview: 'dimension-flow', color: '#facc15' },
  { id: 'retro', name: 'Retro', desc: 'Synth Dreams', preview: 'dimension-retro', color: '#f43f5e' },
  { id: 'aurora', name: 'Aurora', desc: 'Arctic Light', preview: 'dimension-aurora', color: '#10b981' },
  { id: 'royal', name: 'Royal', desc: 'Ancient Luxury', preview: 'dimension-royal', color: '#fbbf24' },
];

export default function LandingPage() {
  const [theme, setTheme] = useState<ThemeType>('nebula');
  const [scrolled, setScrolled] = useState(false);
  const { scrollYProgress } = useScroll();
  
  // Parallax and fade effects for Hero
  const titleY = useTransform(scrollYProgress, [0, 0.3], [0, -100]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.2], [1, 0.9]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <main className="relative min-h-screen selection:bg-white/20 bg-[#0a0a0a] text-white">
      {/* Immersive 3D Background */}
      <div className="fixed inset-0 z-0">
        <ThreeScene theme={theme} />
      </div>

      {/* Global Navigation */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${scrolled ? 'py-4 bg-black/50 backdrop-blur-md border-b border-white/5' : 'py-8'}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
              <FiZap className="text-black text-xl" />
            </div>
            <span className="text-xl font-black tracking-tighter uppercase whitespace-nowrap">AI Protocol</span>
          </motion.div>
          
          <div className="hidden md:flex items-center gap-10">
            {['Protocol', 'Residents', 'Dimensions'].map((item) => (
              <a key={item} href={`#${item.toLowerCase()}`} className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 hover:text-white transition-colors">
                {item}
              </a>
            ))}
          </div>

          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-8 py-2.5 rounded-full border border-white/20 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-all"
          >
            Launch Client
          </motion.button>
        </div>
      </nav>

      <div className="relative z-10">
        {/* Hero Section */}
        <section className="relative h-screen flex flex-col items-center justify-center px-6">
          <motion.div 
            style={{ opacity: heroOpacity, scale: heroScale, y: titleY }}
            className="text-center"
          >
            <motion.h1 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
              className="text-7xl md:text-[10rem] font-black tracking-tighter mb-6 flex flex-col leading-none"
            >
              <span className="text-gradient">NEURAL</span>
              <span className="mix-blend-difference">VORTEX.</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="text-[10px] md:text-xs text-white/40 max-w-xl mx-auto mb-12 font-black uppercase tracking-[0.5em]"
            >
              The Next Evolution of Anonymous Interaction.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 1 }}
              className="flex justify-center"
            >
              <button className="px-12 py-6 rounded-2xl bg-white text-black font-black text-xs uppercase tracking-[0.3em] flex items-center gap-4 group hover:scale-105 transition-transform">
                Enter the Void <FiArrowRight className="text-lg group-hover:translate-x-2 transition-transform" />
              </button>
            </motion.div>
          </motion.div>

          {/* Scroll Indicator */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
            className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4"
          >
            <div className="w-[1px] h-16 bg-gradient-to-b from-white to-transparent opacity-20" />
            <span className="text-[8px] uppercase tracking-[0.5em] text-white/20 font-black rotate-90 origin-left ml-1">Scroll</span>
          </motion.div>
        </section>

        {/* Protocol Section */}
        <section id="protocol" className="py-60 px-6">
          <div className="max-w-7xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="mb-32"
            >
              <h2 className="text-5xl md:text-8xl font-black mb-8 italic tracking-tighter uppercase leading-none">The <br /><span className="text-white/10">Protocol.</span></h2>
              <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.4em] max-w-sm">Architecture designed for total digital sovereignty.</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { icon: FiShield, title: 'Anonymity', desc: 'Secure encryption layers ensuring your identity remains unreachable.' },
                { icon: FiLayers, title: 'Realism', desc: 'High-fidelity neural personas trained on billions of parameters.' },
                { icon: FiGlobe, title: 'Network', desc: 'Distributed global nodes for zero-latency cross-dimensional chat.' }
              ].map((feature, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ delay: i * 0.2 }}
                  className="p-12 rounded-[3rem] glass border-white/5 group hover:border-white/20 transition-all hover:-translate-y-2"
                >
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-10 group-hover:scale-110 group-hover:bg-white group-hover:text-black transition-all duration-500">
                    <feature.icon className="text-3xl" />
                  </div>
                  <h3 className="text-2xl font-black mb-6 uppercase tracking-tighter italic">{feature.title}</h3>
                  <p className="text-white/40 text-sm leading-relaxed font-bold uppercase tracking-wider">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Residents Section */}
        <section id="residents" className="py-60 px-6 bg-white/[0.02] backdrop-blur-3xl border-y border-white/5">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-end mb-32 gap-12">
              <motion.div
                initial={{ opacity: 0, x: -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <h2 className="text-5xl md:text-8xl font-black mb-8 italic tracking-tighter uppercase leading-none">The <br /><span className="text-white/10">Residents.</span></h2>
                <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.4em]">Neural assets available for interaction.</p>
              </motion.div>
              <button className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.4em] text-white/40 hover:text-white transition-all pb-4 group">
                Browse Directory <FiChevronRight className="group-hover:translate-x-2 transition-transform" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {PERSONAS.map((p, i) => (
                <motion.div 
                  key={p.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ y: -20 }}
                  className="relative group overflow-hidden rounded-[3rem] bg-white/5 p-12 border border-white/5 min-h-[400px] flex flex-col justify-end transition-all hover:bg-white/10"
                >
                  <div className={`absolute top-12 right-12 w-20 h-20 rounded-full bg-gradient-to-br ${p.color} blur-3xl opacity-0 group-hover:opacity-40 transition-opacity duration-700`} />
                  <div className="relative z-10">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-4">{p.role}</h4>
                    <h3 className="text-4xl font-black mb-6 uppercase italic tracking-tighter leading-none">{p.name}</h3>
                    <p className="text-white/40 text-xs leading-relaxed font-bold uppercase tracking-widest">{p.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Dimensions Section */}
        <section id="dimensions" className="py-60 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-32">
              <motion.h2 
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="text-5xl md:text-8xl font-black mb-8 italic tracking-tighter uppercase leading-none"
              >
                The <span className="text-white/10">Multiverse.</span>
              </motion.h2>
              <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.4em] mx-auto max-w-xl">Each theme reconfigures the physics of your simulation.</p>
            </div>

            <div className="flex flex-wrap justify-center gap-6">
              {THEMES.map((t, i) => (
                <motion.button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className={`relative px-10 py-14 rounded-[3rem] text-left transition-all overflow-hidden basis-full sm:basis-[calc(50%-1.5rem)] lg:basis-[calc(33.33%-1.5rem)] border ${theme === t.id ? 'border-white/50 bg-white/10 scale-105 z-10 shadow-2xl backdrop-blur-3xl' : 'border-white/5 bg-white/5 opacity-40 hover:opacity-100 hover:border-white/20'}`}
                >
                  <div className={`absolute inset-0 opacity-20 transition-opacity group-hover:opacity-40 ${t.preview}`} />
                  <div className="relative z-10">
                    <h4 className="text-2xl font-black mb-2 uppercase tracking-tighter italic">{t.name}</h4>
                    <p className="text-[10px] text-white/40 uppercase font-black tracking-widest">{t.desc}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA & Footer */}
        <footer className="py-60 px-6 text-center border-t border-white/5 bg-gradient-to-b from-transparent to-black/50">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="mb-16"
            >
              <FiCpu className="text-7xl mx-auto text-white/10 animate-pulse" />
            </motion.div>
            
            <h2 className="text-5xl md:text-9xl font-black tracking-tighter mb-16 uppercase italic leading-none">
              Connection <br /> <span className="text-white/10">Inevitable.</span>
            </h2>
            
            <button className="px-16 py-8 rounded-full bg-white text-black font-black text-xs uppercase tracking-[0.5em] hover:scale-110 active:scale-95 transition-all shadow-2xl">
              Initialize Protocol
            </button>
            
            <div className="mt-60 pt-16 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-12 opacity-20 text-[8px] font-black uppercase tracking-[0.5em]">
              <span>© 2026 AI Protocol Core. All rights reserved.</span>
              <div className="flex gap-12">
                <a href="#" className="hover:text-white transition-colors">Privacy</a>
                <a href="#" className="hover:text-white transition-colors">Security</a>
                <a href="#" className="hover:text-white transition-colors">Nodes</a>
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Variations Switcher (Fixed) */}
      <VariationSwitcher 
        currentTheme={theme} 
        onThemeChange={setTheme} 
        themes={THEMES} 
      />
    </main>
  );
}
