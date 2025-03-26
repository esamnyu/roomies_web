// Create a shared validation utility
// src/lib/validation/invitationValidation.ts
export function validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
  
  export function validateInvitationForm(data: {
    email: string,
    role: string,
    message?: string
  }): {valid: boolean, error?: string} {
    if (!data.email) {
      return {valid: false, error: 'Email is required'};
    }
    
    if (!validateEmail(data.email)) {
      return {valid: false, error: 'Please enter a valid email address'};
    }
    
    return {valid: true};
  }