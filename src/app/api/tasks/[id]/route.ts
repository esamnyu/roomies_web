// src/app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { generateUUID } from '@/lib/utils';

// GET /api/tasks - Get all tasks for the household
export async function GET(request: NextRequest) {
  console.log('GET /api/tasks - Starting handler');
  try {
    // DEBUG: Log cookie access
    console.log('Getting Supabase client with cookies');
    
    // Using updated Next.js 15 approach for Supabase
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    console.log('Fetching auth session');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    // Log authentication state
    if (sessionError) {
      console.error('Session error:', sessionError);
      return NextResponse.json({ error: 'Authentication error' }, { status: 401 });
    }
    
    if (!session) {
      console.log('No active session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('Authenticated as user:', session.user.id);
    
    // Rest of the function remains the same...
    const url = new URL(request.url);
    const householdId = url.searchParams.get('householdId');
    
    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 });
    }
    
    // Check if the user is a member of the household
    const { data: membership, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('userId, role')
      .eq('userId', session.user.id)
      .eq('householdId', householdId)
      .single();
    
    if (membershipError || !membership) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    // Get all tasks for the household
    const { data: tasks, error: tasksError } = await supabase
      .from('Task')
      .select(`
        *,
        creator:creatorId(id, name, avatar),
        assignee:assigneeId(id, name, avatar)
      `)
      .eq('householdId', householdId)
      .order('createdAt', { ascending: false });
    
    if (tasksError) {
      console.error('Error fetching tasks:', tasksError);
      return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }
    
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Error getting tasks:', error);
    return NextResponse.json({ error: 'Failed to get tasks' }, { status: 500 });
  }
}

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  console.log('POST /api/tasks - Starting handler');
  try {
    // DEBUG: Log cookie access
    console.log('Getting Supabase client with cookies');
    
    // Using updated Next.js 15 approach for Supabase
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    console.log('Fetching auth session');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    // Log authentication state
    if (sessionError) {
      console.error('Session error:', sessionError);
      return NextResponse.json({ error: 'Authentication error' }, { status: 401 });
    }
    
    if (!session) {
      console.log('No active session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('Authenticated as user:', session.user.id);
    
    // Get task data from request body
    const data = await request.json();
    console.log('Task data received:', JSON.stringify(data));
    
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
      console.log('Missing required fields:', { title, householdId });
      return NextResponse.json({ 
        error: 'Title and household ID are required' 
      }, { status: 400 });
    }
    
    // Rest of the function remains the same...
    // Check if the user is a member of the household
    console.log('Checking household membership for', session.user.id, 'in household', householdId);
    const { data: membership, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('userId, role')
      .eq('userId', session.user.id)
      .eq('householdId', householdId)
      .single();
    
    if (membershipError) {
      console.error('Membership check error:', membershipError);
      return NextResponse.json({ 
        error: 'Failed to verify household membership' 
      }, { status: 500 });
    }
    
    if (!membership) {
      console.log('User is not a member of this household');
      return NextResponse.json({ 
        error: 'You are not a member of this household' 
      }, { status: 403 });
    }
    
    // Get creator info for the creatorName field
    console.log('Fetching user profile for creator name');
    const { data: userProfile, error: userError } = await supabase
      .from('User')
      .select('id, name')
      .eq('id', session.user.id)
      .single();
    
    if (userError) {
      console.error('Error fetching user profile:', userError);
    }
    
    // Get assignee info if applicable
    let assigneeName = undefined;
    if (assigneeId) {
      console.log('Fetching assignee profile');
      const { data: assignee, error: assigneeError } = await supabase
        .from('User')
        .select('id, name')
        .eq('id', assigneeId)
        .single();
      
      if (assigneeError) {
        console.error('Error fetching assignee:', assigneeError);
      } else if (assignee) {
        assigneeName = assignee.name;
      }
    }
    
    // Generate a task ID
    const taskId = generateUUID();
    console.log('Generated task ID:', taskId);
    
    // Format the date if it exists
    const formattedDueDate = dueDate ? new Date(dueDate).toISOString() : null;
    
    // Create the task
    console.log('Inserting new task into database');
    const taskData = {
      id: taskId,
      title,
      description: description || null,
      status: status || 'PENDING',
      priority: priority || 'MEDIUM',
      creatorId: session.user.id,
      creatorName: userProfile?.name,
      assigneeId: assigneeId || null,
      assigneeName: assigneeName || null,
      dueDate: formattedDueDate,
      recurring: recurring || false,
      recurrenceRule: recurrenceRule || null,
      householdId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    console.log('Task data to insert:', JSON.stringify(taskData));
    
    const { data: task, error: insertError } = await supabase
      .from('Task')
      .insert([taskData])
      .select()
      .single();
    
    if (insertError) {
      console.error('Error creating task:', insertError);
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }
    
    console.log('Task created successfully:', task.id);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('Unexpected error creating task:', error);
    return NextResponse.json({ 
      error: 'Failed to create task', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}