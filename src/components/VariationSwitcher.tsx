'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface Props {
  currentTheme: string;
  onThemeChange: (theme: string) => void;
  themes: { id: string; name: string; color: string }[];
}

export default function VariationSwitcher({ currentTheme, onThemeChange, themes }: Props) {
  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 p-2 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl">
      {themes.map((theme) => (
        <motion.button
          key={theme.id}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onThemeChange(theme.id)}
          className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${
            currentTheme === theme.id 
            ? 'bg-white text-black shadow-lg' 
            : 'text-white/60 hover:text-white hover:bg-white/10'
          }`}
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.color }} />
            {theme.name}
          </div>
        </motion.button>
      ))}
    </div>
  );
}
