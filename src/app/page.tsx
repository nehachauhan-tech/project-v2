'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { FiMessageSquare, FiUsers, FiZap, FiShield, FiChevronRight } from 'react-icons/fi';
import { FaGithub, FaXTwitter, FaInstagram } from 'react-icons/fa6';
import Link from 'next/link';

// Simple Header Component
const Header = () => {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-6 backdrop-blur-md bg-white/30 border-b border-black/5">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center shadow-lg">
          <FiMessageSquare className="text-white w-6 h-6" />
        </div>
        <span className="text-xl font-bold tracking-tight">AI ROLEPLAY</span>
      </div>
      
      <nav className="hidden md:flex items-center gap-10">
        <Link href="#" className="text-sm font-medium hover:text-black/60 transition-colors">Explore</Link>
        <Link href="#" className="text-sm font-medium hover:text-black/60 transition-colors">AI Personas</Link>
        <Link href="#" className="text-sm font-medium hover:text-black/60 transition-colors">About</Link>
      </nav>

      <div className="flex items-center gap-4">
        <button className="text-sm font-semibold hover:text-black/60 transition-colors">Login</button>
        <button className="btn-primary flex items-center gap-2 shadow-xl shadow-black/10">
          Start Chat <FiChevronRight className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

// AI Persona Card Component
const PersonaCard = ({ name, role, description }: { name: string, role: string, description: string }) => {
  return (
    <motion.div 
      whileHover={{ y: -10 }}
      className="glass p-6 group cursor-pointer"
    >
      <div className="w-full aspect-[4/5] bg-zinc-200/50 rounded-xl mb-6 overflow-hidden relative border border-black/5">
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
          <span className="text-white text-[10px] font-bold uppercase tracking-widest">{role}</span>
        </div>
        <div className="w-full h-full flex items-center justify-center bg-zinc-100/30 backdrop-blur-sm">
          <FiUsers className="w-12 h-12 text-black/10" />
        </div>
      </div>
      <h3 className="text-lg font-bold mb-1 tracking-tight">{name}</h3>
      <p className="text-sm text-black/40 leading-relaxed line-clamp-2">{description}</p>
    </motion.div>
  );
};

export default function LandingPage() {
  const personas = [
    {
      name: "Neo Nexus",
      role: "Cyberpunk Informant",
      description: "A rogue AI specialized in encrypted data and futuristic neon streets."
    },
    {
      name: "Elowen Frost",
      role: "Ethereal Sorceress",
      description: "Ancient wisdom from a realm of ice and starlight. Ask for guidance."
    },
    {
      name: "Detective Miller",
      role: "Noir Investigator",
      description: "Gruff, sharp-witted, and ready to solve any mystery you present."
    }
  ];

  return (
    <main className="relative flex flex-col pt-32 lg:pt-48 pb-20 overflow-x-hidden">
      <Header />

      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 -z-10 w-[600px] h-[600px] bg-black/5 rounded-full blur-[120px] -mr-48 -mt-48" />
      <div className="absolute bottom-0 left-0 -z-10 w-[400px] h-[400px] bg-black/5 rounded-full blur-[100px] -ml-24 mb-24" />

      {/* Hero Section */}
      <section className="container mx-auto px-8 text-center mb-40 md:mb-60">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-black/[0.03] border border-black/5 rounded-full mb-10">
            <FiZap className="w-3.5 h-3.5 text-black" />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em]">New: Immersive AI Personas</span>
          </div>
          
          <h1 className="text-[12vw] md:text-[8vw] lg:text-9xl font-extrabold tracking-tighter mb-10 leading-[0.85] text-black">
            CHAT WITH <span className="text-black/15">ANYONE,</span> <br />
            ANYTIME. <span className="text-black/15 group relative cursor-pointer hover:text-black transition-colors duration-500">ANONYMOUSLY.<span className="absolute bottom-4 left-0 w-full h-[0.5px] bg-black/20 origin-right scale-x-0 group-hover:scale-x-100 group-hover:origin-left transition-transform duration-500" /></span>
          </h1>
          
          <p className="text-lg md:text-xl text-black/40 mb-14 max-w-2xl mx-auto leading-relaxed font-medium">
            No registration. No tracking. Just instant connection with random strangers or specialized AI characters. Your secrets are safe with us.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-5">
            <button className="btn-primary px-12 py-5 text-lg shadow-2xl shadow-black/20">Pair Me Randomly</button>
            <button className="btn-secondary px-12 py-5 text-lg">Explore AI Collective</button>
          </div>
        </motion.div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-8 mb-40 md:mb-60">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-10">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="glass p-10 space-y-6"
          >
            <div className="w-14 h-14 bg-black rounded-xl flex items-center justify-center shadow-lg">
              <FiShield className="text-white w-7 h-7" />
            </div>
            <h3 className="text-2xl font-bold tracking-tight">Radical Privacy</h3>
            <p className="text-black/40 leading-relaxed font-medium">
              Zero logs. Zero tracking. We don't want your data, we just want you to talk freely.
            </p>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="glass p-10 space-y-6"
          >
            <div className="w-14 h-14 bg-black rounded-xl flex items-center justify-center shadow-lg">
              <FiUsers className="text-white w-7 h-7" />
            </div>
            <h3 className="text-2xl font-bold tracking-tight">Instant Match</h3>
            <p className="text-black/40 leading-relaxed font-medium">
              Sophisticated interest-based pairing that connects you with the right person in milliseconds.
            </p>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.3 }}
            className="glass p-10 space-y-6"
          >
            <div className="w-14 h-14 bg-black rounded-xl flex items-center justify-center shadow-lg">
              <FiMessageSquare className="text-white w-7 h-7" />
            </div>
            <h3 className="text-2xl font-bold tracking-tight">Roleplay AI</h3>
            <p className="text-black/40 leading-relaxed font-medium">
              Dive into curated scenarios with AI personas that think, feel, and remember your stories.
            </p>
          </motion.div>
        </div>
      </section>

      {/* AI Personas Showcase */}
      <section className="container mx-auto px-8 mb-40 md:mb-60">
        <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-16">
          <div className="max-w-xl">
            <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-black/30 mb-4 items-center flex gap-3">
              <span className="w-8 h-[1px] bg-black/10" /> DISCOVER THE COLLECTIVE
            </h4>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tighter leading-none">CRAFTED FOR <span className="text-black/20 italic font-serif">CONNECTION.</span></h2>
          </div>
          <button className="text-[10px] font-bold flex items-center gap-3 hover:gap-5 transition-all uppercase tracking-[0.2em] group">
            All Personas <FiChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {personas.map((persona, i) => (
            <PersonaCard key={i} {...persona} />
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-8 mb-40 md:mb-60">
        <div className="w-full bg-black rounded-[40px] p-12 md:p-24 text-center text-white relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white/5 rounded-full blur-[100px] -mr-20 -mt-20 group-hover:bg-white/10 transition-colors duration-1000" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-white/5 rounded-full blur-[80px] -ml-10 -mb-10 group-hover:bg-white/10 transition-colors duration-1000" />
          
          <h2 className="text-4xl md:text-6xl font-bold mb-8 tracking-tighter max-w-3xl mx-auto leading-none">
            READY TO JOIN THE <span className="text-white/30 italic">ANONYMOUS</span> CONVERSATION?
          </h2>
          <p className="text-white/40 mb-12 text-lg font-medium max-w-xl mx-auto">
            Experience the internet without the baggage. Just you, your thoughts, and a world of mystery.
          </p>
          <button className="bg-white text-black px-14 py-6 rounded-2xl font-bold text-xl hover:scale-[1.03] active:scale-[0.97] transition-all shadow-2xl shadow-white/10">Pair Now</button>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-8 pt-24 border-t border-black/5">
        <div className="flex flex-col lg:flex-row justify-between items-start gap-16 mb-24">
          <div className="max-w-xs space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black rounded flex items-center justify-center">
                <FiMessageSquare className="text-white w-6 h-6" />
              </div>
              <span className="text-xl font-bold tracking-tighter">AI ROLEPLAY</span>
            </div>
            <p className="text-sm font-medium text-black/30 leading-relaxed">
              Redefining human connection through anonymity and artificial intelligence. Built for the modern web.
            </p>
            <div className="flex gap-6">
              <FaXTwitter className="w-5 h-5 text-black/20 hover:text-black transition-colors cursor-pointer" />
              <FaInstagram className="w-5 h-5 text-black/20 hover:text-black transition-colors cursor-pointer" />
              <FaGithub className="w-5 h-5 text-black/20 hover:text-black transition-colors cursor-pointer" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-16 md:gap-24">
            <div className="space-y-6">
              <h5 className="font-bold text-xs uppercase tracking-[0.2em] text-black/20">Platform</h5>
              <ul className="text-sm font-semibold text-black/40 space-y-4">
                <li><Link href="#" className="hover:text-black transition-colors">Explore</Link></li>
                <li><Link href="#" className="hover:text-black transition-colors">AI Catalog</Link></li>
                <li><Link href="#" className="hover:text-black transition-colors">Random Pair</Link></li>
              </ul>
            </div>
            <div className="space-y-6">
              <h5 className="font-bold text-xs uppercase tracking-[0.2em] text-black/20">Safety</h5>
              <ul className="text-sm font-semibold text-black/40 space-y-4">
                <li><Link href="#" className="hover:text-black transition-colors">Guidelines</Link></li>
                <li><Link href="#" className="hover:text-black transition-colors">Privacy</Link></li>
                <li><Link href="#" className="hover:text-black transition-colors">Legal</Link></li>
              </ul>
            </div>
            <div className="space-y-6 hidden md:block">
              <h5 className="font-bold text-xs uppercase tracking-[0.2em] text-black/20">Connect</h5>
              <ul className="text-sm font-semibold text-black/40 space-y-4">
                <li><Link href="#" className="hover:text-black transition-colors">Discord</Link></li>
                <li><Link href="#" className="hover:text-black transition-colors">Contact</Link></li>
                <li><Link href="#" className="hover:text-black transition-colors">Support</Link></li>
              </ul>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 py-12 border-t border-black/[0.03]">
          <div className="text-[10px] font-bold text-black/20 uppercase tracking-[0.3em]">
            © {new Date().getFullYear()} AI ROLEPLAY CHAT.
          </div>
          <div className="flex gap-8 text-[10px] font-bold text-black/20 uppercase tracking-[0.3em]">
            <Link href="#" className="hover:text-black transition-colors">Cookie Policy</Link>
            <Link href="#" className="hover:text-black transition-colors">User Agreement</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
