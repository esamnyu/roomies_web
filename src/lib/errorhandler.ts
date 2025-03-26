// src/lib/errorhandler.ts
import { NextResponse } from 'next/server';
import { AuthenticationError, AuthorizationError } from '@/lib/auth';
import { ValidationError, ResourceNotFoundError, ConflictError } from '@/lib/services/invitationService';

/**
 * Centralized API error handler for consistent error responses
 */
export function handleApiError(error: unknown) {
  console.error('API error:', error);
  
  // Return appropriate status code based on error type
  if (error instanceof ValidationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  
  if (error instanceof ResourceNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  
  if (error instanceof ConflictError) {
    return NextResponse.json({ 
      error: error.message,
      ...error.details
    }, { status: error.status });
  }
  
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  
  // For unknown errors, return 500
  return NextResponse.json({ 
    error: 'Internal server error',
    message: error instanceof Error ? error.message : 'Unknown error'
  }, { status: 500 });
}