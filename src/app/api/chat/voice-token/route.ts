import { GoogleGenAI, Modality } from '@google/genai';
import { NextResponse } from 'next/server';
import { CHARACTER_MAP } from '@/data/characters';

// authTokens.create requires v1alpha API version
const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_CLOUD_API_KEY!,
  httpOptions: { apiVersion: 'v1alpha' },
});

const LIVE_MODEL = 'gemini-2.0-flash-live-preview-04-09';

// Voice assigned to each character
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

export async function POST(req: Request) {
  try {
    const { characterId } = await req.json();

    if (!characterId) {
      return NextResponse.json({ error: 'Missing characterId' }, { status: 400 });
    }

    const character = CHARACTER_MAP[characterId];
    if (!character) {
      return NextResponse.json({ error: 'Invalid character ID' }, { status: 400 });
    }

    const voiceName  = CHARACTER_VOICES[characterId] ?? 'Sulafat';
    const systemText = character.systemPrompt + '\n\n' + moodContext;

    // Create an ephemeral token for this character's voice session
    // Token is valid for 1 use, expires in 10 minutes
    const expireTime = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
            systemInstruction: { parts: [{ text: systemText }] },
          },
        },
      },
    });

    return NextResponse.json({
      token:       token.name,
      model:       LIVE_MODEL,
      voiceName,
      characterId: character.id,
      character:   character.name,
    });
  } catch (error: any) {
    console.error('Voice Token Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create voice token' },
      { status: 500 }
    );
  }
}
