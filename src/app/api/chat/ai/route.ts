import { GoogleGenAI, type HarmCategory, type HarmBlockThreshold, type ThinkingLevel } from '@google/genai';
import { NextResponse } from 'next/server';
import { AI_CHARACTERS, CHARACTER_MAP } from '@/data/characters';

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_CLOUD_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { characterId, message, history } = await req.json();

    const character = CHARACTER_MAP[characterId];
    if (!character) {
      return NextResponse.json({ error: 'Invalid character ID' }, { status: 400 });
    }

    const modelId = character.model;

    // Mood-aware system prompt: analyze message sentiment for natural responses
    const moodContext = `
MOOD SYSTEM: You must respond according to the emotional tone of the user's message.
- If the user seems sad or stressed, respond with empathy and comfort (like a real human friend would).
- If the user is happy or excited, match their energy and celebrate with them.
- If the user is curious, engage their curiosity with enthusiasm.
- If the user is angry or frustrated, acknowledge their feelings before responding.
- If the user is flirting or being romantic, respond naturally in character (stay appropriate).
- Always feel like a REAL PERSON chatting, never robotic or AI-like.
`;

    const systemInstruction = character.systemPrompt + '\n\n' + moodContext;

    const generationConfig = {
      maxOutputTokens: 4096,
      temperature: 1,
      topP: 0.95,
      thinkingConfig: {
        thinkingLevel: "HIGH" as ThinkingLevel,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HATE_SPEECH' as HarmCategory, threshold: 'OFF' as HarmBlockThreshold },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT' as HarmCategory, threshold: 'OFF' as HarmBlockThreshold },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT' as HarmCategory, threshold: 'OFF' as HarmBlockThreshold },
        { category: 'HARM_CATEGORY_HARASSMENT' as HarmCategory, threshold: 'OFF' as HarmBlockThreshold },
      ],
      tools: [{ googleSearch: {} }],
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
    };

    const formattedHistory = (history || []).map((h: any) => ({
      role: h.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: h.content }],
    }));

    const chat = ai.chats.create({
      model: modelId,
      config: generationConfig,
      history: formattedHistory,
    });

    const result = await chat.sendMessage({
      message: message,
    });

    const responseText = result.text ?? '';

    return NextResponse.json({
      response: responseText,
      model: modelId,
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
