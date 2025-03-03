// src/lib/chat.ts
import { supabaseClient } from './supabase';
import { generateUUID } from '@/lib/utils';
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
  readReceipts?: ReadReceipt[];
}

export interface ReadReceipt {
  id: string;
  messageId: string;
  userId: string;
  readAt: string;
}

// Get messages for a household
export async function getHouseholdMessages(householdId: string): Promise<Message[]> {
  const { data, error } = await supabaseClient
    .from('Message')
    .select(`
      *,
      sender:senderId(id, name, avatar),
      readReceipts:MessageReadReceipt(id, userId, readAt)
    `)
    .eq('householdId', householdId)
    .order('createdAt', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }

  return data || [];
}

// In src/lib/chat.ts
export async function sendMessage(householdId: string, senderId: string, content: string): Promise<Message | null> {
    // Generate a UUID for the message ID
    const messageId = generateUUID(); // Use the same UUID function you've added elsewhere
    const now = new Date().toISOString();
    
    console.log('Sending message with ID:', messageId);
    
    const { data, error } = await supabaseClient
      .from('Message')
      .insert([
        {
          id: messageId, // Explicitly provide an ID
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

// Mark message as read
export async function markMessageAsRead(messageId: string, userId: string): Promise<ReadReceipt | null> {
  // Check if a read receipt already exists
  const { data: existingReceipt, error: receiptError } = await supabaseClient
    .from('MessageReadReceipt')
    .select('id, messageId, userId, readAt')
    .eq('messageId', messageId)
    .eq('userId', userId)
    .single();
  
  if (!receiptError && existingReceipt) {
    // Already marked as read
    return existingReceipt as ReadReceipt;
  }
  
  // Create a new read receipt
  const { data, error } = await supabaseClient
    .from('MessageReadReceipt')
    .insert([
      {
        messageId,
        userId,
        readAt: new Date().toISOString()
      }
    ])
    .select()
    .single();
  
  if (error) {
    console.error('Error marking message as read:', error);
    return null;
  }
  
  return data as ReadReceipt;
}

// Get unread messages count for user in a household
export async function getUnreadMessagesCount(householdId: string, userId: string): Promise<number> {
  // Get all messages for the household
  const { data: messages, error: messagesError } = await supabaseClient
    .from('Message')
    .select('id')
    .eq('householdId', householdId)
    .neq('senderId', userId); // Exclude messages sent by the current user
  
  if (messagesError || !messages) {
    console.error('Error fetching messages for unread count:', messagesError);
    return 0;
  }
  
  if (messages.length === 0) {
    return 0;
  }
  
  // Get read receipts for these messages
  const messageIds = messages.map(msg => msg.id);
  const { data: receipts, error: receiptsError } = await supabaseClient
    .from('MessageReadReceipt')
    .select('messageId')
    .eq('userId', userId)
    .in('messageId', messageIds);
  
  if (receiptsError) {
    console.error('Error fetching read receipts:', receiptsError);
    return 0;
  }
  
  // Count unread messages
  const readMessageIds = receipts?.map(receipt => receipt.messageId) || [];
  const unreadCount = messages.filter(msg => !readMessageIds.includes(msg.id)).length;
  
  return unreadCount;
}

export function subscribeToMessages(householdId: string, callback: (message: Message) => void) {
    const subscription = supabaseClient
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'Message',
          filter: `householdId=eq.${householdId}`
        },
        async (payload) => {
          // Fetch the complete message with sender information
          const { data, error } = await supabaseClient
            .from('Message')
            .select(`
              *,
              sender:senderId(id, name, avatar)
            `)
            .eq('id', payload.new.id)
            .single();
            
          if (!error && data) {
            callback(data as Message);
          } else {
            // Fallback to the raw payload if we can't get the complete message
            callback(payload.new as Message);
          }
        }
      )
      .subscribe();
  
    return () => {
      supabaseClient.removeChannel(subscription);
    };
  }
