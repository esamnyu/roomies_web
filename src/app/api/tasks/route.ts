// src/app/api/tasks/route.ts - Consolidated task API handler
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { generateUUID } from '@/lib/utils';

// GET /api/tasks - Get all tasks for a household
export async function GET(request: NextRequest) {
  console.log('GET /api/tasks - Starting handler');
  try {
    // Create Supabase client with correct cookies handling
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.log('No active session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get household ID from query params
    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('householdId');
    const taskId = searchParams.get('id');
    
    // If task ID is provided, fetch a single task
    if (taskId) {
      console.log('Fetching single task:', taskId);
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
        console.error('Error fetching task:', taskError);
        return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 });
      }
      
      if (!task) {
        return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      }
      
      return NextResponse.json(task);
    }
    
    // Otherwise fetch all tasks for a household
    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 });
    }
    
    // Check if user is a member of the household
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
    console.error('Error in GET /api/tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  console.log('POST /api/tasks - Starting handler');
  try {
    // Create Supabase client with correct cookies handling
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      console.log('No active session found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('User authenticated as:', session.user.id);
    
    // Get task data from request body
    const data = await request.json();
    console.log('Received task data:', JSON.stringify(data));
    
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
      console.log('Missing required fields');
      return NextResponse.json({ error: 'Title and household ID are required' }, { status: 400 });
    }
    
    // Check if user is a member of the household
    const { data: householdUser, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('id, role')
      .eq('userId', session.user.id)
      .eq('householdId', householdId)
      .single();
    
    if (membershipError || !householdUser) {
      console.log('User is not a member of this household');
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    // Generate a task ID
    const taskId = generateUUID();
    console.log('Generated task ID:', taskId);
    
    // Create the task
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
          dueDate: dueDate ? new Date(dueDate).toISOString() : null,
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
      console.error('Error creating task:', createError);
      return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }
    
    console.log('Task created successfully:', task.id);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/tasks:', error);
    return NextResponse.json({ 
      error: 'Failed to create task',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// PATCH /api/tasks?id={taskId} - Update a task
export async function PATCH(request: NextRequest) {
  console.log('PATCH /api/tasks - Starting handler');
  try {
    // Create Supabase client with correct cookies handling
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get task ID from query params
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('id');
    
    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }
    
    const data = await request.json();
    
    // Verify the task exists and user has permission
    const { data: existingTask, error: taskError } = await supabase
      .from('Task')
      .select('id, creatorId, householdId')
      .eq('id', taskId)
      .single();
    
    if (taskError || !existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    // Check if user is a member of the household
    const { data: membership, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('userId, role')
      .eq('userId', session.user.id)
      .eq('householdId', existingTask.householdId)
      .single();
    
    if (membershipError || !membership) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    // Check permissions - only creator or admins can update
    const isCreator = existingTask.creatorId === session.user.id;
    const isAdmin = membership.role === 'ADMIN';
    const isAssignee = data.assigneeId === session.user.id;
    
    if (!isCreator && !isAdmin && !isAssignee) {
      return NextResponse.json({ 
        error: 'You do not have permission to update this task' 
      }, { status: 403 });
    }
    
    // Update the task
    const { data: updatedTask, error: updateError } = await supabase
      .from('Task')
      .update({
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        assigneeId: data.assigneeId,
        dueDate: data.dueDate ? new Date(data.dueDate).toISOString() : null,
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
      console.error('Error updating task:', updateError);
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }
    
    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error('Error in PATCH /api/tasks:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

// DELETE /api/tasks?id={taskId} - Delete a task
export async function DELETE(request: NextRequest) {
  console.log('DELETE /api/tasks - Starting handler');
  try {
    // Create Supabase client with correct cookies handling
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get user session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get task ID from query params
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('id');
    
    if (!taskId) {
      return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
    }
    
    // Verify the task exists and user has permission
    const { data: existingTask, error: taskError } = await supabase
      .from('Task')
      .select('id, creatorId, householdId')
      .eq('id', taskId)
      .single();
    
    if (taskError || !existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    // Check if user is a member of the household
    const { data: membership, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('userId, role')
      .eq('userId', session.user.id)
      .eq('householdId', existingTask.householdId)
      .single();
    
    if (membershipError || !membership) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    // Check permissions - only creator or admins can delete
    const isCreator = existingTask.creatorId === session.user.id;
    const isAdmin = membership.role === 'ADMIN';
    
    if (!isCreator && !isAdmin) {
      return NextResponse.json({ 
        error: 'You do not have permission to delete this task' 
      }, { status: 403 });
    }
    
    // Delete the task
    const { error: deleteError } = await supabase
      .from('Task')
      .delete()
      .eq('id', taskId);
    
    if (deleteError) {
      console.error('Error deleting task:', deleteError);
      return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
    }
    
    return NextResponse.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error in DELETE /api/tasks:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}