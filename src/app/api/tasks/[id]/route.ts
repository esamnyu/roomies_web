// src/app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// GET /api/tasks/[id] - Get a specific task
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Use proper cookie handling - FIXED
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Get user session from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const taskId = params.id;
    
    // Get the task using Supabase
    const { data: task, error: taskError } = await supabase
      .from('Task')
      .select(`
        *,
        creator:creatorId(*),
        assignee:assigneeId(*),
        household:householdId(*)
      `)
      .eq('id', taskId)
      .single();
    
    if (taskError || !task) {
      console.error('Error fetching task:', taskError);
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    // Check if the user is a member of the household that the task belongs to
    const { data: householdUser, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('id, role')
      .eq('userId', session.user.id)
      .eq('householdId', task.householdId)
      .single();
    
    if (membershipError || !householdUser) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    return NextResponse.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 });
  }
}

// PATCH /api/tasks/[id] - Update a specific task
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Use proper cookie handling - FIXED
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Get user session from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const taskId = params.id;
    const data = await request.json();
    
    // Get the current task to verify permissions
    const { data: currentTask, error: taskError } = await supabase
      .from('Task')
      .select(`
        *,
        household:householdId(
          id,
          name
        )
      `)
      .eq('id', taskId)
      .single();
    
    if (taskError || !currentTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    // Check if user is a member of the household
    const { data: membership, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('userId, role')
      .eq('userId', session.user.id)
      .eq('householdId', currentTask.householdId)
      .single();
    
    if (membershipError || !membership) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    // Check if the user is the creator, assignee, or an admin of the household
    const isCreator = currentTask.creatorId === session.user.id;
    const isAssignee = currentTask.assigneeId === session.user.id;
    const isAdmin = membership.role === 'ADMIN';
    
    if (!isCreator && !isAssignee && !isAdmin) {
      return NextResponse.json({ 
        error: 'You are not authorized to update this task' 
      }, { status: 403 });
    }
    
    // Extract the data we want to update
    const { 
      title, 
      description, 
      status, 
      priority, 
      assigneeId, 
      dueDate, 
      recurring, 
      recurrenceRule 
    } = data;
    
    // Prepare the update data
    const updateData: any = {};
    
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) {
      updateData.status = status;
      
      // If the task is being marked as completed, set the completedAt date
      if (status === 'COMPLETED' && currentTask.status !== 'COMPLETED') {
        updateData.completedAt = new Date().toISOString();
      } 
      // If the task is being un-completed, remove the completedAt date
      else if (status !== 'COMPLETED' && currentTask.status === 'COMPLETED') {
        updateData.completedAt = null;
      }
    }
    if (priority !== undefined) updateData.priority = priority;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate).toISOString() : null;
    if (recurring !== undefined) updateData.recurring = recurring;
    if (recurrenceRule !== undefined) updateData.recurrenceRule = recurrenceRule;
    
    // Update the task using Supabase
    const { data: updatedTask, error: updateError } = await supabase
      .from('Task')
      .update(updateData)
      .eq('id', taskId)
      .select(`
        *,
        creator:creatorId(*),
        assignee:assigneeId(*)
      `)
      .single();
    
    if (updateError) {
      console.error('Error updating task:', updateError);
      return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }
    
    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

// DELETE /api/tasks/[id] - Delete a specific task
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Use proper cookie handling - FIXED
    const cookieStore = cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
    
    // Get user session from Supabase
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const taskId = params.id;
    
    // Get the task to verify permissions
    const { data: task, error: taskError } = await supabase
      .from('Task')
      .select(`
        *,
        household:householdId(id, name)
      `)
      .eq('id', taskId)
      .single();
    
    if (taskError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    // Check if user is a member of the household and their role
    const { data: membership, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('userId, role')
      .eq('userId', session.user.id)
      .eq('householdId', task.householdId)
      .single();
    
    if (membershipError || !membership) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    // Check if the user is the creator or an admin of the household
    const isCreator = task.creatorId === session.user.id;
    const isAdmin = membership.role === 'ADMIN';
    
    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: 'You are not authorized to delete this task' }, { status: 403 });
    }
    
    // Delete the task using Supabase
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
    console.error('Error deleting task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}