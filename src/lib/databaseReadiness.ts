// src/lib/databaseReadiness.ts
import { supabaseClient } from './supabase';

/**
 * Check if the Message table is ready to use
 * @returns {Promise<boolean>} True if the table exists and is accessible
 */
export async function isMessageTableReady(): Promise<boolean> {
  try {
    // Try to select a single record from the Message table
    const { data, error } = await supabaseClient
      .from('Message')
      .select('id')
      .limit(1);
    
    // If there's no error, the table exists and is accessible
    if (!error) {
      console.log('Message table is ready to use');
      return true;
    }
    
    // Log the specific error
    console.error('Message table not ready:', error.message);
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
    // Check if Message table is ready
    const isMessageReady = await isMessageTableReady();
    
    // Check MessageReadReceipt table
    const { error: receiptError } = await supabaseClient
      .from('MessageReadReceipt')
      .select('id')
      .limit(1);
    
    const isReceiptReady = !receiptError;
    
    // Overall readiness status
    const allReady = isMessageReady && isReceiptReady;
    
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