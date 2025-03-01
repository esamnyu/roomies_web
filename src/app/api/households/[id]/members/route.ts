// src/app/api/households/[id]/members/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Define interfaces for our data structures
interface UserData {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    createdAt: string;
  }
  
  interface HouseholdMember {
    id: string;
    userId: string;
    role: string;
    joinedAt: string;
    user: UserData;
  }
  
  interface FormattedMember {
    id: string;
    userId: string;
    role: string;
    joinedAt: string;
    name: string;
    email: string;
    avatar: string | null;
    createdAt: string;
  }

// GET /api/households/[id]/members - Get all members of a household
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
  ) {
    try {
      // Create a Supabase client with the user's session
      const supabaseAuth = createServerComponentClient({ cookies });
      
      // Get the current user's session
      const { data: { session } } = await supabaseAuth.auth.getSession();
      
      if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      
      const householdId = params.id;
      
      // Check if the user is a member of this household
      const { data: membership, error: membershipError } = await supabase
        .from('HouseholdUser')
        .select('userId, role')
        .eq('userId', session.user.id)
        .eq('householdId', householdId)
        .single();
      
      if (membershipError || !membership) {
        return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
      }
      
      // Get all members of the household with their user details
      const { data, error: membersError } = await supabase
        .from('HouseholdUser')
        .select(`
          id,
          userId,
          role,
          joinedAt,
          user:userId(
            id,
            name,
            email,
            avatar,
            createdAt
          )
        `)
        .eq('householdId', householdId)
        .order('joinedAt', { ascending: false });
      
      if (membersError) {
        console.error('Error fetching household members:', membersError);
        return NextResponse.json({ error: 'Failed to fetch household members' }, { status: 500 });
      }
      
      // Format the member data for response
      const formattedMembers: FormattedMember[] = [];
      
      // Process each member individually to avoid TypeScript errors
      if (data && Array.isArray(data)) {
        for (const member of data) {
          // Check if member and member.user exist
          if (member && member.user) {
            const userData = member.user as unknown as UserData;
            
            formattedMembers.push({
              id: member.id,
              userId: member.userId,
              role: member.role,
              joinedAt: member.joinedAt,
              name: userData.name,
              email: userData.email,
              avatar: userData.avatar,
              createdAt: userData.createdAt
            });
          }
        }
      }
      
      return NextResponse.json(formattedMembers);
    } catch (error) {
      console.error('Error fetching household members:', error);
      return NextResponse.json({ error: 'Failed to fetch household members' }, { status: 500 });
    }
  }

// POST /api/households/[id]/members - Add a member to the household
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Create a Supabase client with the user's session
    const supabaseAuth = createServerComponentClient({ cookies });
    
    // Get the current user's session
    const { data: { session } } = await supabaseAuth.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const householdId = params.id;
    const { email, role = 'MEMBER' } = await request.json();
    
    // Check if the current user is a member and admin of the household
    const { data: currentMembership, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('userId, role')
      .eq('userId', session.user.id)
      .eq('householdId', householdId)
      .single();
    
    if (membershipError || !currentMembership) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    if (currentMembership.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only household admins can add members' }, { status: 403 });
    }
    
    // Find the user by email
    const { data: user, error: userError } = await supabase
      .from('User')
      .select('id, name, email')
      .eq('email', email)
      .single();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Check if the user is already a member of the household
    const { data: existingMember, error: existingError } = await supabase
      .from('HouseholdUser')
      .select('id')
      .eq('userId', user.id)
      .eq('householdId', householdId)
      .single();
    
    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member of this household' }, { status: 400 });
    }
    
    // Add the user to the household
    const { data: newMember, error: addError } = await supabase
      .from('HouseholdUser')
      .insert([
        {
          userId: user.id,
          householdId: householdId,
          role: role as 'ADMIN' | 'MEMBER' | 'GUEST',
          joinedAt: new Date().toISOString()
        }
      ])
      .select(`
        id,
        userId,
        householdId,
        role,
        joinedAt,
        user:userId(
          id,
          name,
          email,
          avatar
        )
      `)
      .single();
    
    if (addError) {
      console.error('Error adding member to household:', addError);
      return NextResponse.json({ error: 'Failed to add member to household' }, { status: 500 });
    }
    
    // Format the response
    const formattedMember = {
      id: newMember.id,
      userId: newMember.userId,
      householdId: newMember.householdId,
      role: newMember.role,
      joinedAt: newMember.joinedAt,
      user: newMember.user
    };
    
    return NextResponse.json(formattedMember, { status: 201 });
  } catch (error) {
    console.error('Error adding household member:', error);
    return NextResponse.json({ error: 'Failed to add household member' }, { status: 500 });
  }
}

// Instead of importing from separate files, define the handlers here
// PATCH /api/households/[id]/members/[userId] - Update a member's role
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  try {
    // Create a Supabase client with the user's session
    const supabaseAuth = createServerComponentClient({ cookies });
    
    // Get the current user's session
    const { data: { session } } = await supabaseAuth.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id: householdId, userId } = params;
    const { role } = await request.json();
    
    // Check if the current user is a member and admin of the household
    const { data: currentMembership, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('userId, role')
      .eq('userId', session.user.id)
      .eq('householdId', householdId)
      .single();
    
    if (membershipError || !currentMembership) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    if (currentMembership.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only household admins can update member roles' }, { status: 403 });
    }
    
    // Prevent changing your own role (to avoid removing the last admin)
    if (userId === session.user.id) {
      return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 });
    }
    
    // Update the member's role
    const { data: updatedMember, error: updateError } = await supabase
      .from('HouseholdUser')
      .update({ role: role as 'ADMIN' | 'MEMBER' | 'GUEST' })
      .eq('userId', userId)
      .eq('householdId', householdId)
      .select(`
        id,
        userId,
        householdId,
        role,
        joinedAt,
        user:userId(
          id,
          name,
          email,
          avatar
        )
      `)
      .single();
    
    if (updateError) {
      console.error('Error updating member role:', updateError);
      return NextResponse.json({ error: 'Failed to update member role' }, { status: 500 });
    }
    
    return NextResponse.json(updatedMember);
  } catch (error) {
    console.error('Error updating member role:', error);
    return NextResponse.json({ error: 'Failed to update member role' }, { status: 500 });
  }
}

// DELETE /api/households/[id]/members/[userId] - Remove a member from the household
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; userId: string } }
) {
  try {
    // Create a Supabase client with the user's session
    const supabaseAuth = createServerComponentClient({ cookies });
    
    // Get the current user's session
    const { data: { session } } = await supabaseAuth.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id: householdId, userId } = params;
    
    // User can remove themselves, or admins can remove others
    const isCurrentUser = userId === session.user.id;
    
    if (!isCurrentUser) {
      // Check if the current user is a member and admin of the household
      const { data: currentMembership, error: membershipError } = await supabase
        .from('HouseholdUser')
        .select('userId, role')
        .eq('userId', session.user.id)
        .eq('householdId', householdId)
        .single();
      
      if (membershipError || !currentMembership) {
        return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
      }
      
      if (currentMembership.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only household admins can remove members' }, { status: 403 });
      }
    }
    
    // Check if the user to be removed is an admin
    const { data: memberToRemove, error: memberError } = await supabase
      .from('HouseholdUser')
      .select('userId, role')
      .eq('userId', userId)
      .eq('householdId', householdId)
      .single();
    
    if (memberError || !memberToRemove) {
      return NextResponse.json({ error: 'Member not found in the household' }, { status: 404 });
    }
    
    // If removing an admin, check if they're the last admin
    if (memberToRemove.role === 'ADMIN') {
      const { count: adminCount } = await supabase
        .from('HouseholdUser')
        .select('id', { count: 'exact', head: true })
        .eq('householdId', householdId)
        .eq('role', 'ADMIN');
      
      if (adminCount !== null && adminCount <= 1) {
        return NextResponse.json({ 
          error: 'Cannot remove the last admin. Assign another admin first.' 
        }, { status: 400 });
      }
    }
    
    // Remove the household member
    const { error: deleteError } = await supabase
      .from('HouseholdUser')
      .delete()
      .eq('userId', userId)
      .eq('householdId', householdId);
    
    if (deleteError) {
      console.error('Error removing household member:', deleteError);
      return NextResponse.json({ error: 'Failed to remove household member' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      message: 'Member removed successfully',
      removed: {
        userId,
        householdId
      }
    });
  } catch (error) {
    console.error('Error removing household member:', error);
    return NextResponse.json({ error: 'Failed to remove household member' }, { status: 500 });
  }
}