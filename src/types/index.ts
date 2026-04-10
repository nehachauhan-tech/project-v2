export interface Profile {
  id: string;
  display_name: string;
  age: number | null;
  bio: string;
  avatar_url: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  participant_1: string;
  participant_2: string | null;
  bot_id: string | null;
  last_message_text: string;
  last_message_at: string;
  created_at: string;
  // Joined fields
  participant_1_profile?: Profile;
  participant_2_profile?: Profile;
}

export type MessageType = 'text' | 'image' | 'audio' | 'video' | 'document';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  role: 'user' | 'assistant';
  content: string;
  message_type: MessageType;
  media_url: string | null;
  media_name: string | null;
  media_size: number | null;
  created_at: string;
}

export interface OnlineUser {
  user_id: string;
  display_name: string;
  avatar_url: string;
  online_at: string;
}

export interface AIBot {
  id: string;
  name: string;
  role: string;
  avatar: string;
  color: string;
  motto: string;
}
