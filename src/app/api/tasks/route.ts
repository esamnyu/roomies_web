// src/app/api/tasks/route.ts - Consolidated task API handler with enhanced logging
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { generateUUID } from '@/lib/utils';

// GET /api/tasks - Get all tasks for a household
export async function GET(request: NextRequest) {
  console.log('[Tasks API] GET /api/tasks - Starting handler');
  try {
    // Create Supabase client with correct cookies handling
    console.log('[Tasks API] Initializing Supabase client');
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );
    
    // Get user session
    console.log('[Tasks API] Getting user session');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('[Tasks API] Session error:', sessionError);
      return NextResponse.json({ error: 'Authentication error' }, { status: 401 });
    }
    
    if (!session) {
      console.log('[Tasks API] No active session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('[Tasks API] User authenticated:', session.user.id);
    
    // Get household ID from query params
    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('householdId');
    const taskId = searchParams.get('id');
    
    console.log('[Tasks API] Query parameters:', { householdId, taskId });
    
    // If task ID is provided, fetch a single task
    if (taskId) {
      console.log('[Tasks API] Fetching single task:', taskId);
      const { data: task, error: taskError } = await supabase
        .from('Task')
        .select(`
          *,
          creator:creatorId(id, name, avatar),
          assignee:assigneeId(id, name, avatar)
        `)
        .eq('id', taskId)
        .single();
      
      if (taskError) {
        console.error('[Tasks API] Error fetching task:', taskError);
        return NextResponse.json({ error: 'Failed to fetch task', details: taskError.message }, { status: 500 });
      }
      
      if (!task) {
        console.log('[Tasks API] Task not found:', taskId);
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }
      
      console.log('[Tasks API] Task found successfully');
      return NextResponse.json(task);
    }
    
    // Otherwise fetch all tasks for a household
    if (!householdId) {
      console.log('[Tasks API] Missing household ID parameter');
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 });
    }
    
    // Check if user is a member of the household
    console.log('[Tasks API] Checking household membership for user', session.user.id);
    const { data: householdUser, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('id, role')
      .eq('userId', session.user.id)
      .eq('householdId', householdId)
      .single();
    
    if (membershipError) {
      console.error('[Tasks API] Membership check error:', membershipError);
      return NextResponse.json({ error: 'Error verifying household membership', details: membershipError.message }, { status: 500 });
    }
    
    if (!householdUser) {
      console.log('[Tasks API] User is not a member of household:', householdId);
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    console.log('[Tasks API] User membership verified, role:', householdUser.role);
    
    // Fetch all tasks for the household
    console.log('[Tasks API] Fetching tasks for household:', householdId);
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
      console.error('[Tasks API] Error fetching tasks:', tasksError);
      return NextResponse.json({ error: 'Failed to fetch tasks', details: tasksError.message }, { status: 500 });
    }
    
    console.log('[Tasks API] Successfully fetched', tasks?.length || 0, 'tasks');
    return NextResponse.json(tasks || []);
  } catch (error) {
    console.error('[Tasks API] Unhandled error in GET /api/tasks:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch tasks',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  console.log('[Tasks API] POST /api/tasks - Starting handler');
  try {
    // Create Supabase client with correct cookies handling
    console.log('[Tasks API] Initializing Supabase client');
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );
    
    // Get user session
    console.log('[Tasks API] Getting user session');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('[Tasks API] Session error:', sessionError);
      return NextResponse.json({ error: 'Authentication error' }, { status: 401 });
    }
    
    if (!session) {
      console.log('[Tasks API] No active session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('[Tasks API] User authenticated as:', session.user.id);
    
    // Get task data from request body
    let data;
    try {
      data = await request.json();
      console.log('[Tasks API] Received task data:', JSON.stringify(data));
    } catch (parseError) {
      console.error('[Tasks API] Error parsing request body:', parseError);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
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
      console.log('[Tasks API] Missing required fields');
      return NextResponse.json({ error: 'Title and household ID are required' }, { status: 400 });
    }
    
    // Check if user is a member of the household
    console.log('[Tasks API] Checking household membership for user', session.user.id);
    const { data: householdUser, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('id, role')
      .eq('userId', session.user.id)
      .eq('householdId', householdId)
      .single();
    
    if (membershipError) {
      console.error('[Tasks API] Membership check error:', membershipError);
      return NextResponse.json({ error: 'Error verifying household membership', details: membershipError.message }, { status: 500 });
    }
    
    if (!householdUser) {
      console.log('[Tasks API] User is not a member of household:', householdId);
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    console.log('[Tasks API] User membership verified, role:', householdUser.role);
    
    // Generate a task ID
    const taskId = generateUUID();
    console.log('[Tasks API] Generated task ID:', taskId);
    
    // Format due date if provided
    const formattedDueDate = dueDate ? 
      (dueDate instanceof Date ? dueDate.toISOString() : new Date(dueDate).toISOString()) : 
      null;
    
    // Create the task
    console.log('[Tasks API] Creating new task');
    const { data: task, error: createError } = await supabase
      .from('Task')
      .insert([
        {
          id: taskId,
          title,
          description: description || null,
          status: status || 'PENDING',
          priority: priority || 'MEDIUM',
          creatorId: session.user.id,
          assigneeId: assigneeId || null,
          dueDate: formattedDueDate,
          recurring: recurring || false,
          recurrenceRule: recurrenceRule || null,
          householdId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ])
      .select(`
        *,
        creator:creatorId(id, name, email, avatar),
        assignee:assigneeId(id, name, email, avatar)
      `)
      .single();
    
    if (createError) {
      console.error('[Tasks API] Error creating task:', createError);
      return NextResponse.json({ error: 'Failed to create task', details: createError.message }, { status: 500 });
    }
    
    console.log('[Tasks API] Task created successfully:', task.id);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('[Tasks API] Unhandled error in POST /api/tasks:', error);
    return NextResponse.json({ 
      error: 'Failed to create task',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// PATCH /api/tasks?id={taskId} - Update a task
export async function PATCH(request: NextRequest) {
  console.log('[Tasks API] PATCH /api/tasks - Starting handler');
  try {
    // Create Supabase client with correct cookies handling
    console.log('[Tasks API] Initializing Supabase client');
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );
    
    // Get user session
    console.log('[Tasks API] Getting user session');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('[Tasks API] Session error:', sessionError);
      return NextResponse.json({ error: 'Authentication error' }, { status: 401 });
    }
    
    if (!session) {
      console.log('[Tasks API] No active session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('[Tasks API] User authenticated as:', session.user.id);
    
    // Get task ID from query params
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('id');
    
    if (!taskId) {
      console.log('[Tasks API] Missing task ID parameter');
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }
    
    console.log('[Tasks API] Updating task:', taskId);
    
    // Get request body
    let data;
    try {
      data = await request.json();
      console.log('[Tasks API] Update data:', JSON.stringify(data));
    } catch (parseError) {
      console.error('[Tasks API] Error parsing request body:', parseError);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
    // Verify the task exists and user has permission
    console.log('[Tasks API] Verifying task exists');
    const { data: existingTask, error: taskError } = await supabase
      .from('Task')
      .select('id, creatorId, householdId')
      .eq('id', taskId)
      .single();
    
    if (taskError) {
      console.error('[Tasks API] Error fetching task:', taskError);
      return NextResponse.json({ error: 'Failed to fetch task', details: taskError.message }, { status: 500 });
    }
    
    if (!existingTask) {
      console.log('[Tasks API] Task not found:', taskId);
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    console.log('[Tasks API] Task found, checking household membership');
    
    // Check if user is a member of the household
    const { data: membership, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('userId, role')
      .eq('userId', session.user.id)
      .eq('householdId', existingTask.householdId)
      .single();
    
    if (membershipError) {
      console.error('[Tasks API] Membership check error:', membershipError);
      return NextResponse.json({ error: 'Error verifying household membership', details: membershipError.message }, { status: 500 });
    }
    
    if (!membership) {
      console.log('[Tasks API] User is not a member of household');
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    console.log('[Tasks API] User membership verified, role:', membership.role);
    
    // Check permissions - only creator or admins can update
    const isCreator = existingTask.creatorId === session.user.id;
    const isAdmin = membership.role === 'ADMIN';
    const isAssignee = data.assigneeId === session.user.id;
    
    console.log('[Tasks API] Permission check:', { isCreator, isAdmin, isAssignee });
    
    if (!isCreator && !isAdmin && !isAssignee) {
      console.log('[Tasks API] User does not have permission to update this task');
      return NextResponse.json({ 
        error: 'You do not have permission to update this task' 
      }, { status: 403 });
    }
    
    // Format due date if provided
    const formattedDueDate = data.dueDate ? 
      (data.dueDate instanceof Date ? data.dueDate.toISOString() : new Date(data.dueDate).toISOString()) : 
      null;
    
    // Update the task
    console.log('[Tasks API] Updating task in database');
    const { data: updatedTask, error: updateError } = await supabase
      .from('Task')
      .update({
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        assigneeId: data.assigneeId,
        dueDate: formattedDueDate,
        recurring: data.recurring || false,
        recurrenceRule: data.recurrenceRule,
        completedAt: data.status === 'COMPLETED' ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString()
      })
      .eq('id', taskId)
      .select(`
        *,
        creator:creatorId(id, name, avatar),
        assignee:assigneeId(id, name, avatar)
      `)
      .single();
    
    if (updateError) {
      console.error('[Tasks API] Error updating task:', updateError);
      return NextResponse.json({ error: 'Failed to update task', details: updateError.message }, { status: 500 });
    }
    
    console.log('[Tasks API] Task updated successfully');
    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error('[Tasks API] Unhandled error in PATCH /api/tasks:', error);
    return NextResponse.json({ 
      error: 'Failed to update task',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE /api/tasks?id={taskId} - Delete a task
export async function DELETE(request: NextRequest) {
  console.log('[Tasks API] DELETE /api/tasks - Starting handler');
  try {
    // Create Supabase client with correct cookies handling
    console.log('[Tasks API] Initializing Supabase client');
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );
    
    // Get user session
    console.log('[Tasks API] Getting user session');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('[Tasks API] Session error:', sessionError);
      return NextResponse.json({ error: 'Authentication error' }, { status: 401 });
    }
    
    if (!session) {
      console.log('[Tasks API] No active session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('[Tasks API] User authenticated as:', session.user.id);
    
    // Get task ID from query params
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('id');
    
    if (!taskId) {
      console.log('[Tasks API] Missing task ID parameter');
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }
    
    console.log('[Tasks API] Deleting task:', taskId);
    
    // Verify the task exists and user has permission
    const { data: existingTask, error: taskError } = await supabase
      .from('Task')
      .select('id, creatorId, householdId')
      .eq('id', taskId)
      .single();
    
    if (taskError) {
      console.error('[Tasks API] Error fetching task:', taskError);
      return NextResponse.json({ error: 'Failed to fetch task', details: taskError.message }, { status: 500 });
    }
    
    if (!existingTask) {
      console.log('[Tasks API] Task not found:', taskId);
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    console.log('[Tasks API] Task found, checking household membership');
    
    // Check if user is a member of the household
    const { data: membership, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('userId, role')
      .eq('userId', session.user.id)
      .eq('householdId', existingTask.householdId)
      .single();
    
    if (membershipError) {
      console.error('[Tasks API] Membership check error:', membershipError);
      return NextResponse.json({ error: 'Error verifying household membership', details: membershipError.message }, { status: 500 });
    }
    
    if (!membership) {
      console.log('[Tasks API] User is not a member of household');
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    console.log('[Tasks API] User membership verified, role:', membership.role);
    
    // Check permissions - only creator or admins can delete
    const isCreator = existingTask.creatorId === session.user.id;
    const isAdmin = membership.role === 'ADMIN';
    
    console.log('[Tasks API] Permission check:', { isCreator, isAdmin });
    
    if (!isCreator && !isAdmin) {
      console.log('[Tasks API] User does not have permission to delete this task');
      return NextResponse.json({ 
        error: 'You do not have permission to delete this task' 
      }, { status: 403 });
    }
    
    // Delete the task
    console.log('[Tasks API] Deleting task from database');
    const { error: deleteError } = await supabase
      .from('Task')
      .delete()
      .eq('id', taskId);
    
    if (deleteError) {
      console.error('[Tasks API] Error deleting task:', deleteError);
      return NextResponse.json({ error: 'Failed to delete task', details: deleteError.message }, { status: 500 });
    }
    
    console.log('[Tasks API] Task deleted successfully');
    return NextResponse.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('[Tasks API] Unhandled error in DELETE /api/tasks:', error);
    return NextResponse.json({ 
      error: 'Failed to delete task',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}