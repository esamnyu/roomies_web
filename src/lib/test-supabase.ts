// src/lib/test-supabase.js
const { createClient } = require('@supabase/supabase-js');

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Check if environment variables are available
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables!');
  console.log('Make sure you have NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file');
  process.exit(1);
}

// Initialize Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    
    // Test a simple query - trying to access public schema information
    const { data, error } = await supabase
      .from('User')
      .select('count()', { count: 'exact' });
    
    if (error) {
      console.error('❌ Supabase query failed:', error.message);
      
      // Try a different approach - check if we can reach Supabase at all
      const { data: healthData, error: healthError } = await supabase.rpc('get_service_status');
      
      if (healthError) {
        console.error('❌ Could not connect to Supabase:', healthError.message);
      } else {
        console.log('✅ Supabase is reachable, but the query failed. This might be due to:');
        console.log('  - The "User" table doesn\'t exist yet');
        console.log('  - Permissions issues (Row Level Security)');
        console.log('  - The table name is different from "User"');
      }
      
      return false;
    }
    
    console.log('✅ Supabase connection successful!');
    console.log('Query result:', data);
    return true;
  } catch (err) {
    console.error('❌ Unexpected error testing Supabase connection:', err);
    return false;
  }
}

// Run the test with environment variables loaded from .env
require('dotenv').config();
testSupabaseConnection();