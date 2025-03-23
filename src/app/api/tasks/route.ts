// src/app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// GET /api/tasks
export async function GET(request: NextRequest) {
  try {
    // Use proper cookie handling - FIXED
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Get user session from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get household ID from query params
    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('householdId');
    
    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 });
    }
    
    // Check if user is a member of the household - using Supabase
    const { data: householdUser, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('id, role')
      .eq('userId', session.user.id)
      .eq('householdId', householdId)
      .single();
    
    if (membershipError || !householdUser) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    // Fetch all tasks for the household
    const { data: tasks, error: tasksError } = await supabase
      .from('Task')
      .select(`
        *,
        creator:creatorId(id, name, email, avatar),
        assignee:assigneeId(id, name, email, avatar)
      `)
      .eq('householdId', householdId)
      .order('priority', { ascending: false })
      .order('dueDate', { ascending: true });
    
    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }
    
    return NextResponse.json(tasks || []);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

// POST /api/tasks
export async function POST(request: NextRequest) {
  try {
    // Use proper cookie handling - FIXED
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Get user session from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const data = await request.json();
    const { 
      title, 
      description, 
      status, 
      priority, 
      assigneeId, 
      dueDate, 
      recurring, 
      recurrenceRule, 
      householdId 
    } = data;
    
    // Validate required fields
    if (!title || !householdId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Check if user is a member of the household - using Supabase
    const { data: householdUser, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('id, role')
      .eq('userId', session.user.id)
      .eq('householdId', householdId)
      .single();
    
    if (membershipError || !householdUser) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    // Create the task using Supabase
    const { data: task, error: taskError } = await supabase
      .from('Task')
      .insert([
        {
          title,
          description,
          status: status || 'PENDING',
          priority: priority || 'MEDIUM',
          creatorId: session.user.id,
          assigneeId,
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
          recurring: recurring || false,
          recurrenceRule,
          householdId,
        }
      ])
      .select(`
        *,
        creator:creatorId(id, name, email, avatar),
        assignee:assigneeId(id, name, email, avatar)
      `)
      .single();
    
    if (taskError) {
      console.error('Error creating task:', taskError);
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }
    
    return NextResponse.json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}