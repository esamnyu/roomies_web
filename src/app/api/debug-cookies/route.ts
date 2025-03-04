// src/app/api/debug-cookies/route.ts
// FOR DEBUGGING ONLY - REMOVE THIS FILE AFTER DEBUGGING
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    // Properly access cookies without chaining .get()
    const cookieStore = await cookies();
    
    // Get all cookie names
    const cookieNames = cookieStore.getAll().map((cookie: { name: any; }) => cookie.name);
    
    // Look for specific Supabase-related cookies
    const authCookies = cookieStore.getAll()
      .filter((cookie: { name: string; }) => cookie.name.startsWith('sb-') || cookie.name.includes('auth'))
      .map((cookie: { name: any; value: string; }) => ({
        name: cookie.name,
        // Don't show actual value for security
        hasValue: Boolean(cookie.value),
        // Show just the first few characters for debugging
        valuePreview: cookie.value ? `${cookie.value.substring(0, 5)}...` : null
      }));
    
    return NextResponse.json({
      message: 'Cookie debug information',
      allCookieNames: cookieNames,
      authRelatedCookies: authCookies,
    });
  } catch (error) {
    console.error('Error debugging cookies:', error);
    return NextResponse.json({ error: 'Failed to debug cookies' }, { status: 500 });
  }
}