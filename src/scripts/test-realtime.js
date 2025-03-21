// src/scripts/test-realtime.js (create this file)

const { supabaseClient } = require('../lib/supabase');

async function testRealtime() {
  console.log('Testing Supabase Realtime...');
  
  const householdId = '538f30e2-2840-4173-a571-32064011eac2'; // your test household ID
  
  // Subscribe to changes
  const channel = supabaseClient
    .channel('messages')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'Message',
        filter: `householdId=eq.${householdId}`
      },
      (payload) => {
        console.log('New message:', payload);
      }
    )
    .subscribe();
  
  console.log('Subscribed to channel. Waiting for messages...');
  
  // Keep the script running
  return new Promise(() => {});
}

testRealtime().catch(console.error);