// src/lib/databaseReadiness.ts
import { supabaseClient } from './supabase';

/**
 * Check if the messages table is ready to use
 * @returns {Promise<boolean>} True if the table exists and is accessible
 */
export async function isMessageTableReady(): Promise<boolean> {
  try {
    console.log('Checking if messages table is ready...');

    // Get the current user session first to ensure authenticated
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      console.error('No active session for database check');
      return false;
    }

    // Try to select a single record from the messages table
    const { data, error } = await supabaseClient
      .from('messages')
      .select('id')
      .limit(1);

    console.log('messages table check result:', { data, error });

    // If there's no error, the table exists and is accessible
    if (!error) {
      console.log('messages table is ready to use');
      return true;
    }

    // Log the specific error
    console.error('messages table not ready:', error.message, error.details, error.hint, error.code);
    return false;
  } catch (err) {
    console.error('Error checking messages table:', err);
    return false;
  }
}

/**
 * Check if all chat-related tables are ready to use
 * @returns {Promise<{ready: boolean, tables: Record<string, boolean>}>} Status of all tables
 */
export async function areAllChatTablesReady(): Promise<{ready: boolean, tables: Record<string, boolean>}> {
  try {
    console.log('Checking if all chat tables are ready...');

    // Get the current user's session
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      console.error('No active session for database tables check');
      return {
        ready: false,
        tables: {
          messages: false,
          conversations: false
        }
      };
    }

    console.log('User session found:', session.user.id);

    // Check if messages table is ready
    const isMessagesReady = await isMessageTableReady();

    // Check conversations table
    console.log('Checking if conversations table is ready...');
    const { error: conversationsError } = await supabaseClient
      .from('conversations')
      .select('id')
      .limit(1);

    const isConversationsReady = !conversationsError;
    if (isConversationsReady) {
      console.log('conversations table is ready to use');
    } else {
      console.error('conversations table not ready:',
        conversationsError?.message
      );
    }

    // Overall readiness status
    const allReady = isMessagesReady && isConversationsReady;

    console.log('Chat tables readiness summary:', {
      ready: allReady,
      messages: isMessagesReady,
      conversations: isConversationsReady
    });

    return {
      ready: allReady,
      tables: {
        messages: isMessagesReady,
        conversations: isConversationsReady
      }
    };
  } catch (err) {
    console.error('Error checking chat tables:', err);
    return {
      ready: false,
      tables: {
        messages: false,
        conversations: false
      }
    };
  }
}
