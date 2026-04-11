import { GoogleGenAI, type HarmCategory, type HarmBlockThreshold, ThinkingLevel } from '@google/genai';
import { NextResponse } from 'next/server';
import { CHARACTER_MAP } from '@/data/characters';

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_CLOUD_API_KEY!,
});

// Single model for all roleplay characters
const CHAT_MODEL = 'gemini-3-flash-preview';

const moodContext = `
REPLY LENGTH RULE — THIS IS CRITICAL:
Match your reply length to the user's message. This is the most important rule.
- Short message (hi, hello, how are you, ok, haha, lol, 1-5 words) → reply with 1 short sentence max. No paragraphs.
- Medium message (1-2 sentences) → reply with 1-2 sentences max.
- Long message or question → reply with a proper response, still conversational.
- NEVER send a wall of text unprompted. Real people text short replies to short messages.
- Do NOT ask multiple questions in one reply. Ask one question at most.
- Do NOT over-explain. Keep it natural like a real WhatsApp/texting conversation.

MOOD SYSTEM: Respond to the emotional tone of the user's message.
- Sad/stressed → empathy and comfort, keep it brief and warm.
- Happy/excited → match their energy briefly.
- Curious → engage with enthusiasm but concisely.
- Angry/frustrated → acknowledge feelings first.
- Flirting/romantic → respond naturally in character.
- Always feel like a REAL PERSON texting, never like an AI writing an essay.
`;

export async function POST(req: Request) {
  try {
    const { characterId, message, history } = await req.json();

    const character = CHARACTER_MAP[characterId];
    if (!character) {
      return NextResponse.json({ error: 'Invalid character ID' }, { status: 400 });
    }

    const systemInstruction = character.systemPrompt + '\n\n' + moodContext;

    // Build conversation history in the format expected by the API
    const formattedHistory = (history || []).map((h: any) => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }],
    }));

    // Append the new user message
    const contents = [
      ...formattedHistory,
      {
        role: 'user',
        parts: [{ text: message }],
      },
    ];

    const config = {
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.MINIMAL,
      },
      maxOutputTokens: 512,
      temperature: 1,
      topP: 0.95,
      safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH' as HarmCategory, threshold: 'OFF' as HarmBlockThreshold },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as HarmCategory, threshold: 'OFF' as HarmBlockThreshold },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as HarmCategory, threshold: 'OFF' as HarmBlockThreshold },
        { category: 'HARM_CATEGORY_HARASSMENT' as HarmCategory, threshold: 'OFF' as HarmBlockThreshold },
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
    };

    // Use generateContentStream as shown in the official example
    const response = await ai.models.generateContentStream({
      model: CHAT_MODEL,
      config,
      contents,
    });

    // Collect all streamed chunks into a single response text
    let responseText = '';
    for await (const chunk of response) {
      if (chunk.text) {
        responseText += chunk.text;
      }
    }

    return NextResponse.json({
      response: responseText,
      model: CHAT_MODEL,
      character: character.name,
      characterId: character.id,
    });
  } catch (error: any) {
    console.error('AI Route Error:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
