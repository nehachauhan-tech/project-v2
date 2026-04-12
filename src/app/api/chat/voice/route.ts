import { GoogleGenAI, Modality, MediaResolution, type LiveServerMessage } from '@google/genai';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CHARACTER_MAP } from '@/data/characters';

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_CLOUD_API_KEY!,
  httpOptions: { apiVersion: 'v1beta' },
});

// Server-side Supabase client with service role for storage uploads
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LIVE_MODEL = 'gemini-3.1-flash-live-preview';

// Voice assigned to each character — user-specified mapping
const CHARACTER_VOICES: Record<string, string> = {
  sara:      'Sulafat',
  aman:      'Charon',
  surbhi:    'Achernar',
  harry:     'Puck',
  spiderman: 'Pulcherrima',
  alex:      'Orbit',
};

const moodContext = `
REPLY LENGTH RULE — THIS IS CRITICAL:
Match your reply length to the user's message.
- Short message (1-5 words) → 1 short sentence max.
- Medium message (1-2 sentences) → 1-2 sentences max.
- Long message or question → proper response, still conversational.
- NEVER send a wall of text. Ask max ONE question per reply.
- Always feel like a REAL PERSON talking, not an AI.
`;

// ── WAV helpers ────────────────────────────────────────────────────────────────

function createWavHeader(dataByteLength: number, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const byteRate   = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const header     = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataByteLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataByteLength, 40);

  return header;
}

function parseMimeType(mimeType: string): { sampleRate: number; bitsPerSample: number } {
  const opts = { sampleRate: 24000, bitsPerSample: 16 };

  const rateMatch = mimeType.match(/rate=(\d+)/);
  if (rateMatch) opts.sampleRate = parseInt(rateMatch[1]);

  // e.g. "audio/L16;rate=24000" → bitsPerSample = 16
  const formatMatch = mimeType.match(/audio\/L(\d+)/);
  if (formatMatch) opts.bitsPerSample = parseInt(formatMatch[1]);

  return opts;
}

function buildWav(rawPcmChunks: string[], mimeType: string): Buffer {
  const { sampleRate, bitsPerSample } = parseMimeType(mimeType);
  const pcmBuffers = rawPcmChunks.map((b64) => Buffer.from(b64, 'base64'));
  const pcmData    = Buffer.concat(pcmBuffers);
  const wavHeader  = createWavHeader(pcmData.length, sampleRate, 1, bitsPerSample);
  return Buffer.concat([wavHeader, pcmData]);
}

// ── Route ──────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { characterId, message, history, conversationId, userId } = await req.json();

    if (!characterId || !message || !conversationId || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const character = CHARACTER_MAP[characterId];
    if (!character) {
      return NextResponse.json({ error: 'Invalid character ID' }, { status: 400 });
    }

    const voiceName  = CHARACTER_VOICES[characterId] ?? 'Sulafat';
    const systemText = character.systemPrompt + '\n\n' + moodContext;

    // Build conversation history for context
    const historyTurns = (history || []).map((h: any) => ({
      role:  h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }],
    }));

    // ── Connect to Gemini Live API for real-time audio generation ──────────────
    const audioParts: string[] = [];
    let   mimeType             = 'audio/pcm;rate=24000';
    let   textFallback         = '';

    // Promise that resolves when the model's turn is complete
    const turnComplete = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        resolve(); // don't block forever — resolve after 30s
      }, 30000);

      ai.live.connect({
        model: LIVE_MODEL,
        config: {
          responseModalities: [Modality.AUDIO],
          mediaResolution: MediaResolution.MEDIA_RESOLUTION_MEDIUM,
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
          systemInstruction: { parts: [{ text: systemText }] },
          contextWindowCompression: {
            triggerTokens: 104857,
            slidingWindow: { targetTokens: 52428 },
          },
        },
        callbacks: {
          onopen: () => {},
          onmessage: (msg: LiveServerMessage) => {
            // Collect audio data from the model's turn
            if (msg.serverContent?.modelTurn?.parts) {
              for (const part of msg.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  audioParts.push(part.inlineData.data);
                  if (part.inlineData.mimeType) mimeType = part.inlineData.mimeType;
                }
                if (part.text) {
                  textFallback += part.text;
                }
              }
            }

            // Model finished its turn
            if (msg.serverContent?.turnComplete) {
              clearTimeout(timeout);
              resolve();
            }
          },
          onerror: (e: ErrorEvent) => {
            console.error('Live session error:', e.message);
            clearTimeout(timeout);
            reject(new Error(e.message));
          },
          onclose: () => {
            clearTimeout(timeout);
            resolve();
          },
        },
      }).then((session) => {
        // Send conversation history as context (without triggering a response)
        if (historyTurns.length > 0) {
          session.sendClientContent({
            turns: historyTurns,
            turnComplete: false,
          });
        }

        // Send the current user message and request a response
        session.sendClientContent({
          turns: [{ role: 'user', parts: [{ text: message }] }],
          turnComplete: true,
        });

        // Close session once the turn completes
        turnComplete.then(() => {
          try { session.close(); } catch {}
        });
      }).catch((err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    await turnComplete;

    if (audioParts.length === 0) {
      return NextResponse.json({
        textFallback: textFallback || 'Sorry, I couldn\'t generate a voice reply.',
        audioUrl: null,
      });
    }

    // ── Build WAV ──────────────────────────────────────────────────────────────
    const wavBuffer = buildWav(audioParts, mimeType);

    // ── Upload to Supabase storage ─────────────────────────────────────────────
    const fileName    = `voice_${Date.now()}.wav`;
    const storagePath = `${userId}/${conversationId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('project-v2-media')
      .upload(storagePath, wavBuffer, {
        contentType:  'audio/wav',
        cacheControl: '3600',
        upsert:       false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload audio', textFallback }, { status: 500 });
    }

    const { data: urlData } = supabase.storage
      .from('project-v2-media')
      .getPublicUrl(storagePath);

    return NextResponse.json({
      audioUrl:     urlData.publicUrl,
      textFallback,
      character:    character.name,
      characterId:  character.id,
      voiceName,
    });
  } catch (error: any) {
    console.error('Voice Route Error:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
