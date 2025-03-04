// src/lib/databaseReadiness.ts
import { supabaseClient } from './supabase';

/**
 * Check if the Message table is ready to use
 * @returns {Promise<boolean>} True if the table exists and is accessible
 */
export async function isMessageTableReady(): Promise<boolean> {
  try {
    console.log('Checking if Message table is ready...');
    
    // Get the current user session first to ensure authenticated
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      console.error('No active session for database check');
      return false;
    }
    
    // Try to select a single record from the Message table
    const { data, error } = await supabaseClient
      .from('Message')
      .select('id')
      .limit(1);
    
    console.log('Message table check result:', { data, error });
    
    // If there's no error, the table exists and is accessible
    if (!error) {
      console.log('Message table is ready to use');
      return true;
    }
    
    // Log the specific error
    console.error('Message table not ready:', error.message, error.details, error.hint, error.code);
    return false;
  } catch (err) {
    console.error('Error checking Message table:', err);
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
          message: false,
          messageReadReceipt: false
        }
      };
    }
    
    console.log('User session found:', session.user.id);
    
    // Check if Message table is ready
    const isMessageReady = await isMessageTableReady();
    
    // Check MessageReadReceipt table
    console.log('Checking if MessageReadReceipt table is ready...');
    const { data: receiptData, error: receiptError } = await supabaseClient
      .from('MessageReadReceipt')
      .select('id')
      .limit(1);
    
    console.log('MessageReadReceipt table check result:', { receiptData, receiptError });
    
    const isReceiptReady = !receiptError;
    if (isReceiptReady) {
      console.log('MessageReadReceipt table is ready to use');
    } else {
      console.error('MessageReadReceipt table not ready:', 
        receiptError?.message, 
        receiptError?.details, 
        receiptError?.hint,
        receiptError?.code
      );
    }
    
    // Overall readiness status
    const allReady = isMessageReady && isReceiptReady;
    
    console.log('Chat tables readiness summary:', {
      ready: allReady,
      message: isMessageReady,
      messageReadReceipt: isReceiptReady
    });
    
    return {
      ready: allReady,
      tables: {
        message: isMessageReady,
        messageReadReceipt: isReceiptReady
      }
    };
  } catch (err) {
    console.error('Error checking chat tables:', err);
    return {
      ready: false,
      tables: {
        message: false,
        messageReadReceipt: false
      }
    };
  }
}