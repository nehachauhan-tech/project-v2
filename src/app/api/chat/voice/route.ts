import { GoogleGenAI, Modality, type HarmCategory, type HarmBlockThreshold, ThinkingLevel } from '@google/genai';
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CHARACTER_MAP } from '@/data/characters';

const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_CLOUD_API_KEY! });

// Server-side Supabase client with service role for storage uploads
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CHAT_MODEL = 'gemini-3-flash-preview';

// Voice assigned to each character — chosen to match their personality
// Available Gemini voices: Aoede, Charon, Fenrir, Kore, Puck, Orbit, Zephyr, Leda
const CHARACTER_VOICES: Record<string, string> = {
  sara:      'Aoede',    // Warm, friendly female voice
  aman:      'Charon',   // Deep, authoritative male voice
  surbhi:    'Kore',     // Soft, warm female voice
  harry:     'Fenrir',   // Energetic young male voice
  spiderman: 'Puck',     // Light, witty male voice
  alex:      'Orbit',    // Adventurous, expressive male voice
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
  const byteRate      = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign    = numChannels * bitsPerSample / 8;
  const header        = Buffer.alloc(44);

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataByteLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);          // PCM chunk size
  header.writeUInt16LE(1, 20);           // PCM format
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataByteLength, 40);

  return header;
}

function buildWav(rawPcmChunks: string[], mimeType: string): Buffer {
  // Parse sample rate from mimeType, e.g. "audio/pcm;rate=24000"
  const rateMatch = mimeType.match(/rate=(\d+)/);
  const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;

  const pcmBuffers = rawPcmChunks.map((b64) => Buffer.from(b64, 'base64'));
  const pcmData    = Buffer.concat(pcmBuffers);
  const wavHeader  = createWavHeader(pcmData.length, sampleRate);
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

    const voiceName  = CHARACTER_VOICES[characterId] ?? 'Aoede';
    const systemText = character.systemPrompt + '\n\n' + moodContext;

    // Build conversation history
    const formattedHistory = (history || []).map((h: any) => ({
      role:  h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }],
    }));

    const contents = [
      ...formattedHistory,
      { role: 'user', parts: [{ text: message }] },
    ];

    // ── Call Gemini with AUDIO output ──────────────────────────────────────────
    const response = await ai.models.generateContentStream({
      model: CHAT_MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
        thinkingConfig:  { thinkingLevel: ThinkingLevel.MINIMAL },
        temperature:     1,
        topP:            0.95,
        safetySettings: [
          { category: 'HARM_CATEGORY_HATE_SPEECH'       as HarmCategory, threshold: 'OFF' as HarmBlockThreshold },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as HarmCategory, threshold: 'OFF' as HarmBlockThreshold },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as HarmCategory, threshold: 'OFF' as HarmBlockThreshold },
          { category: 'HARM_CATEGORY_HARASSMENT'        as HarmCategory, threshold: 'OFF' as HarmBlockThreshold },
        ],
        systemInstruction: { parts: [{ text: systemText }] },
      },
      contents,
    });

    // Collect audio chunks + any text fallback
    const audioParts: string[] = [];
    let   mimeType             = 'audio/pcm;rate=24000';
    let   textFallback         = '';

    for await (const chunk of response) {
      const part = chunk.candidates?.[0]?.content?.parts?.[0];
      if (part?.inlineData?.data) {
        audioParts.push(part.inlineData.data);
        if (part.inlineData.mimeType) mimeType = part.inlineData.mimeType;
      }
      if (chunk.text) textFallback += chunk.text;
    }

    if (audioParts.length === 0) {
      // Model returned text only — fall back to text response
      return NextResponse.json({ textFallback, audioUrl: null });
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
