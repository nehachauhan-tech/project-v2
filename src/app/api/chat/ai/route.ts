import { GoogleGenAI, type HarmCategory, type HarmBlockThreshold, ThinkingLevel } from '@google/genai';
import { NextResponse } from 'next/server';
import { CHARACTER_MAP } from '@/data/characters';

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_CLOUD_API_KEY!,
});

// Single model for all roleplay characters
const CHAT_MODEL = 'gemini-3-flash-preview';

const moodContext = `
MOOD SYSTEM: You must respond according to the emotional tone of the user's message.
- If the user seems sad or stressed, respond with empathy and comfort (like a real human friend would).
- If the user is happy or excited, match their energy and celebrate with them.
- If the user is curious, engage their curiosity with enthusiasm.
- If the user is angry or frustrated, acknowledge their feelings before responding.
- If the user is flirting or being romantic, respond naturally in character (stay appropriate).
- Always feel like a REAL PERSON chatting, never robotic or AI-like.
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
        thinkingLevel: ThinkingLevel.HIGH,
      },
      maxOutputTokens: 4096,
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
