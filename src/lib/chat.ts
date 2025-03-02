// src/lib/chat.ts
import { supabaseClient } from './supabase';

// Types
export interface Message {
  id: string;
  householdId: string;
  senderId: string;
  content: string;
  contentType?: string;
  createdAt: string;
  updatedAt: string;
  sender?: {
    id: string;
    name: string;
    avatar?: string;
  };
}

// Get messages for a household
export async function getHouseholdMessages(householdId: string): Promise<Message[]> {
  const { data, error } = await supabaseClient
    .from('Message')
    .select(`
      *,
      sender:senderId(id, name, avatar)
    `)
    .eq('householdId', householdId)
    .order('createdAt', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }

  return data || [];
}

// Send a new message
export async function sendMessage(householdId: string, senderId: string, content: string): Promise<Message | null> {
  const now = new Date().toISOString();
  
  const { data, error } = await supabaseClient
    .from('Message')
    .insert([
      {
        householdId,
        senderId,
        content,
        contentType: 'TEXT',
        createdAt: now,
        updatedAt: now
      }
    ])
    .select()
    .single();

  if (error) {
    console.error('Error sending message:', error);
    return null;
  }

  return data;
}

// Subscribe to new messages
export function subscribeToMessages(householdId: string, callback: (message: Message) => void) {
  const subscription = supabaseClient
    .channel(`messages:${householdId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'Message',
        filter: `householdId=eq.${householdId}`
      },
      (payload) => {
        callback(payload.new as Message);
      }
    )
    .subscribe();

  return () => {
    supabaseClient.removeChannel(subscription);
  };
}