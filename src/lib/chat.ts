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
  console.log(`Fetching messages for household: ${householdId}`);
  
  try {
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

    console.log(`Retrieved ${data?.length || 0} messages for household ${householdId}`);
    return data || [];
  } catch (err) {
    console.error('Unexpected error fetching messages:', err);
    return [];
  }
}

// Send a message to a household
export async function sendMessage(householdId: string, senderId: string, content: string): Promise<Message | null> {
  // Generate a UUID for the message ID
  const messageId = generateUUID();
  const now = new Date().toISOString();
  
  console.log(`Sending message with ID: ${messageId} to household: ${householdId}`);
  
  try {
    const { data, error } = await supabaseClient
      .from('Message')
      .insert([
        {
          id: messageId,
          householdId,
          senderId,
          content,
          contentType: 'TEXT',
          createdAt: now,
          updatedAt: now
        }
      ])
      .select(`
        *,
        sender:senderId(id, name, avatar)
      `)
      .single();
  
    if (error) {
      console.error(`Error sending message to household ${householdId}:`, error);
      // Provide more detailed error information for debugging
      if (error.code === '42501') {
        console.error('Permission denied - check RLS policies');
      } else if (error.code === '23505') {
        console.error('Duplicate ID - UUID collision');
      } else if (error.code === '42P01') {
        console.error('Table does not exist');
      }
      return null;
    }
  
    console.log('Message sent successfully:', data);
    return data;
  } catch (err) {
    console.error('Unexpected error sending message:', err);
    return null;
  }
}

// Mark message as read
export async function markMessageAsRead(messageId: string, userId: string): Promise<ReadReceipt | null> {
  console.log(`Marking message ${messageId} as read by user ${userId}`);
  
  try {
    // Check if a read receipt already exists
    const { data: existingReceipt, error: receiptError } = await supabaseClient
      .from('MessageReadReceipt')
      .select('id, messageId, userId, readAt')
      .eq('messageId', messageId)
      .eq('userId', userId)
      .single();
    
    if (!receiptError && existingReceipt) {
      // Already marked as read
      console.log(`Message ${messageId} already marked as read`);
      return existingReceipt as ReadReceipt;
    }
    
    // Generate a UUID for the receipt
    const receiptId = generateUUID();
    
    // Create a new read receipt
    const { data, error } = await supabaseClient
      .from('MessageReadReceipt')
      .insert([
        {
          id: receiptId,
          messageId,
          userId,
          readAt: new Date().toISOString()
        }
      ])
      .select()
      .single();
    
    if (error) {
      console.error('Error marking message as read:', error);
      if (error.code === '42501') {
        console.error('Permission denied - check RLS policies');
      }
      return null;
    }
    
    console.log(`Successfully marked message ${messageId} as read`);
    return data as ReadReceipt;
  } catch (err) {
    console.error('Unexpected error marking message as read:', err);
    return null;
  }
}

// Get unread messages count for user in a household
export async function getUnreadMessagesCount(householdId: string, userId: string): Promise<number> {
  console.log(`Calculating unread messages for user ${userId} in household ${householdId}`);
  
  try {
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
    
    console.log(`User ${userId} has ${unreadCount} unread messages in household ${householdId}`);
    return unreadCount;
  } catch (err) {
    console.error('Unexpected error getting unread count:', err);
    return 0;
  }
}

export function subscribeToMessages(householdId: string, callback: (message: Message) => void) {
    console.log(`Setting up message subscription for household: ${householdId}`);
    
    try {
      // Use a unique channel name that includes the household ID
      const channel = supabaseClient
        .channel(`messages-${householdId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'Message',
            filter: `householdId=eq.${householdId}`
          },
          async (payload) => {
            console.log('Subscription received new message:', payload);
            
            // Fetch the complete message with sender information
            try {
              const { data, error } = await supabaseClient
                .from('Message')
                .select(`
                  *,
                  sender:senderId(id, name, avatar)
                `)
                .eq('id', payload.new.id)
                .single();
                
              if (!error && data) {
                console.log('Complete message data:', data);
                callback(data as Message);
              } else {
                // Log error but still use the payload data
                console.error('Error fetching complete message:', error);
                // Convert the payload to match the Message interface as closely as possible
                const simpleMessage: Message = {
                  id: payload.new.id,
                  householdId: payload.new.householdId,
                  senderId: payload.new.senderId,
                  content: payload.new.content,
                  contentType: payload.new.contentType || 'TEXT',
                  createdAt: payload.new.createdAt || new Date().toISOString(),
                  updatedAt: payload.new.updatedAt || new Date().toISOString()
                };
                callback(simpleMessage);
              }
            } catch (err) {
              console.error('Error in subscription callback:', err);
              // Still try to use the payload even if the fetch fails
              callback(payload.new as Message);
            }
          }
        )
        .subscribe((status) => {
          console.log(`Subscription status for household ${householdId}:`, status);
        });
    
      return () => {
        console.log(`Removing subscription for household: ${householdId}`);
        supabaseClient.removeChannel(channel);
      };
    } catch (error) {
      console.error('Error setting up message subscription:', error);
      // Return a no-op cleanup function
      return () => {};
    }
}