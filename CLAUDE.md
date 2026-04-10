# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Critical: Next.js 16 Breaking Changes

This project uses **Next.js 16.2.2** which has breaking changes from prior versions. **Always read the relevant guide in `node_modules/next/dist/docs/` before writing any code.** Do not rely on training data for Next.js APIs, conventions, or file structure. Heed deprecation notices.

## Commands

- **Dev server**: `npm run dev`
- **Production build**: `npm run build`
- **Start production**: `npm start`
- **Lint**: `npm run lint`

No test framework is configured.

## Architecture

**AI Roleplay Chat** - An anonymous chat app where users talk to AI personas or other users in real-time, wrapped in a futuristic themed UI.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS v4, Framer Motion |
| 3D | Three.js via React Three Fiber + Drei |
| AI | Google Gemini API (`@google/genai`) |
| Backend/Realtime | Supabase (PostgreSQL + Realtime subscriptions + Presence) |
| Icons | Lucide React, React Icons |

### Route Structure

- `/` - Landing page with 3D themed backgrounds, AI persona showcase, theme switcher
- `/chat` - Chat interface with sidebar (sessions, online users, AI bots)
- `/api/chat/ai` - POST endpoint for Gemini AI responses (accepts character name, message, history)

### Key Patterns

- **Theme system**: 6 visual themes (Nebula, Cyber, Flow, Retro, Aurora, Royal) controlled by `VariationSwitcher` component, each with unique color palettes and 3D scenes in `ThreeScene`
- **Dual chat modes**: AI bot conversations (via `/api/chat/ai`) and real-time user sessions (via Supabase Realtime)
- **Supabase tables**: `chat_sessions_project_v2` (sessions), `chat_messages_project_v2` (messages), plus `online_users` presence channel
- **AI personas**: Vance (pilot), Kira (operative), Elias (archivist), Nova (mechanic) - each with distinct system prompts in `route.ts`
- **Path alias**: `@/*` maps to `./src/*`

### Design System

Defined in `DESIGN.md`. Key tokens:
- Font: Plus Jakarta Sans (loaded in layout.tsx)
- Aesthetic: Glassmorphism (backdrop-blur), generous whitespace, micro-animations via Framer Motion
- Surface: Cards with 16px rounding, subtle shadows
- All components are client-side (`"use client"`) due to 3D/animation requirements

### Environment Variables

Required in `.env.local`:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (server-side only)
- `GOOGLE_CLOUD_API_KEY` - Google Gemini API key (server-side only)
