// This file is meant to replace a possible existing file in the Pages Router
// src/pages/api/invitations/index.ts or src/pages/api/invitations.ts

import { NextApiRequest, NextApiResponse } from 'next';
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Create authenticated Supabase client
  const supabase = createServerSupabaseClient({ req, res });
  
  // Get user from session
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  // Check if user is authenticated
  if (sessionError || !session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  // Handle different HTTP methods
  if (req.method === 'GET') {
    try {
      // Get invitations for the current user
      const { data: invitations, error } = await supabase
        .from('Invitation')
        .select(`
          id,
          email,
          householdId,
          role,
          status,
          createdAt,
          household:householdId(
            id,
            name,
            address
          ),
          inviter:inviterId(
            id,
            name,
            email
          )
        `)
        .eq('email', session.user.email)
        .order('createdAt', { ascending: false });
      
      if (error) {
        return res.status(500).json({ error: 'Failed to fetch invitations' });
      }
      
      return res.status(200).json(invitations || []);
    } catch (error) {
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  } else if (req.method === 'POST') {
    try {
      const { email, householdId, role = 'MEMBER', message } = req.body;
      
      // Validate input
      if (!email || !householdId) {
        return res.status(400).json({ error: 'Email and household ID are required' });
      }
      
      // Check if the user is a member and admin of the household
      const { data: membership, error: membershipError } = await supabase
        .from('HouseholdUser')
        .select('userId, role')
        .eq('userId', session.user.id)
        .eq('householdId', householdId)
        .single();
      
      if (membershipError || !membership) {
        return res.status(403).json({ error: 'You are not a member of this household' });
      }
      
      if (membership.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Only household admins can send invitations' });
      }
      
      // Check if an invitation already exists
      const { data: existingInvitation, error: invitationError } = await supabase
        .from('Invitation')
        .select('id, status')
        .eq('email', email)
        .eq('householdId', householdId)
        .maybeSingle();
      
      if (existingInvitation && existingInvitation.status === 'PENDING') {
        return res.status(400).json({ 
          error: 'An invitation has already been sent to this email' 
        });
      }
      
      // Create the invitation
      const { data: invitation, error: createError } = await supabase
        .from('Invitation')
        .insert([
          {
            email,
            householdId,
            inviterId: session.user.id,
            role,
            status: 'PENDING',
            message,
            createdAt: new Date().toISOString()
          }
        ])
        .select()
        .single();
      
      if (createError) {
        return res.status(500).json({ error: 'Failed to create invitation' });
      }
      
      return res.status(201).json(invitation);
    } catch (error) {
      return res.status(500).json({ error: 'An unexpected error occurred' });
    }
  } else {
    // Method not allowed
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}