// src/app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
// Removed unused Supabase client creation imports from '@supabase/ssr' & 'next/headers'
// import { createServerClient, type CookieOptions } from '@supabase/ssr';
// import { cookies } from 'next/headers';
// Import the standardized Supabase client helper
import { createServerSupabaseClient } from '@/lib/supabase-ssr'; // Adjust path if needed (check for supbase-ssr vs supabase-ssr typo)
import { type CookieOptions } from '@supabase/ssr'; // Keep CookieOptions if used by helper typing, though unlikely needed here directly
import { generateUUID } from '@/lib/utils'; // Assuming you have this utility

// Removed local helper function - use imported createServerSupabaseClient instead
/*
const createSupabaseClient = async () => {
    // ... implementation ...
}
*/


// GET /api/tasks - Get all tasks for a household or a single task
export async function GET(request: NextRequest) {
  console.log('[Tasks API] GET /api/tasks - Starting handler');
  try {
    // Use the imported standardized helper
    const supabase = await createServerSupabaseClient();

    // Use getUser() to check authentication
    console.log('[Tasks API] Getting authenticated user');
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError) {
      console.error('[Tasks API] Auth getUser error:', userError);
      return NextResponse.json({ error: 'Authentication error' }, { status: 401 });
    }
    if (!user) {
      console.log('[Tasks API] No authenticated user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('[Tasks API] User authenticated:', user.id);

    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('householdId');
    const taskId = searchParams.get('taskId');

     if (!householdId && !taskId) {
        return NextResponse.json({ error: 'Either householdId or taskId query parameter is required' }, { status: 400 });
    }

    // --- Fetch Single Task ---
    if (taskId) {
        console.log('[Tasks API] Fetching single task:', taskId);
        // Use the 'supabase' instance from the helper
        const { data: task, error: taskError } = await supabase
          .from('Task')
          .select(`
            *,
            creator:creatorId(id, name, avatar),
            assignee:assigneeId(id, name, avatar)
          `)
          .eq('id', taskId)
          .maybeSingle();

        if (taskError) {
          console.error('[Tasks API] Error fetching single task:', taskError);
          return NextResponse.json({ error: 'Failed to fetch task', details: taskError.message }, { status: 500 });
        }
        if (!task) {
          console.log('[Tasks API] Task not found:', taskId);
          return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        // Add a check: Ensure the user belongs to the task's household
        // Use the 'supabase' instance from the helper
         const { data: taskMembership, error: taskMembershipError } = await supabase
             .from('HouseholdUser')
             .select('id')
             .eq('userId', user.id)
             .eq('householdId', task.householdId)
             .limit(1)
             .maybeSingle();

         if(taskMembershipError){
             console.error('[Tasks API] Error checking task membership:', taskMembershipError);
             return NextResponse.json({ error: 'Failed to verify task authorization' }, { status: 500 });
         }
         if (!taskMembership) {
             console.log('[Tasks API] User', user.id, 'not authorized for task', taskId, 'in household', task.householdId);
             return NextResponse.json({ error: 'Not authorized to access this task' }, { status: 403 });
         }

        console.log('[Tasks API] Single task found successfully');
        return NextResponse.json(task);
    }

    // --- Fetch Tasks for Household ---
    if (householdId) {
      console.log('[Tasks API] Checking household membership for user', user.id, 'in household', householdId);
      // Use the 'supabase' instance from the helper
      const { data: householdUser, error: membershipError } = await supabase
        .from('HouseholdUser')
        .select('id, role')
        .eq('userId', user.id)
        .eq('householdId', householdId)
        .maybeSingle();

      if (membershipError) {
           console.error('[Tasks API] Membership check error:', membershipError);
           return NextResponse.json({ error: 'Error verifying household membership', details: membershipError.message }, { status: 500 });
      }
      if (!householdUser) {
           console.log('[Tasks API] User', user.id, 'is not a member of household:', householdId);
           return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
      }
       console.log('[Tasks API] User membership verified, role:', householdUser.role);

       // Fetch tasks for household
       console.log('[Tasks API] Fetching tasks for household:', householdId);
       // Use the 'supabase' instance from the helper
       const { data: tasks, error: tasksError } = await supabase
          .from('Task')
          .select(`
              *,
              creator:creatorId(id, name, email, avatar),
              assignee:assigneeId(id, name, email, avatar)
          `)
          .eq('householdId', householdId)
          .order('priority', { ascending: false })
          .order('dueDate', { ascending: true, nullsFirst: false });

       if (tasksError) {
            console.error('[Tasks API] Error fetching tasks:', tasksError);
            return NextResponse.json({ error: 'Failed to fetch tasks', details: tasksError.message }, { status: 500 });
        }
       console.log('[Tasks API] Successfully fetched', tasks?.length || 0, 'tasks');
       return NextResponse.json(tasks || []);
    }

    // This part should not be reachable if the initial check is correct, but added for safety
    return NextResponse.json({ error: 'Invalid request state' }, { status: 400 });

  } catch (error) {
     console.error('[Tasks API] Unhandled error in GET /api/tasks:', error);
     const message = error instanceof Error ? error.message : 'Unknown error';
     return NextResponse.json({ error: 'Failed to fetch tasks', details: message }, { status: 500 });
  }
}


// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  console.log('[Tasks API] POST /api/tasks - Starting handler');
  try {
    // Use the imported standardized helper
    const supabase = await createServerSupabaseClient();

    // Use getUser()
    console.log('[Tasks API] Getting authenticated user');
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    // Add explicit error handling for getUser
    if (userError) {
        console.error('[Tasks API] Auth getUser error:', userError);
        return NextResponse.json({ error: 'Authentication error', details: userError.message }, { status: 401 });
    }
    if (!user) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
    console.log('[Tasks API] User authenticated as:', user.id);

    let data;
    try { data = await request.json(); } catch (e) { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });}
    const {
        title,
        description,
        status = 'PENDING', // Default status
        priority = 'MEDIUM', // Default priority
        assigneeId,
        dueDate,
        recurring = false, // Default recurring
        recurrenceRule,
        householdId
    } = data;

    // Validate required fields
    if (!title || !householdId) {
      return NextResponse.json({ error: 'Title and household ID are required' }, { status: 400 });
    }

    // Check membership using user.id
    console.log('[Tasks API] Checking household membership for user', user.id);
    // Use the 'supabase' instance from the helper
    const { data: householdUser, error: membershipError } = await supabase
        .from('HouseholdUser')
        .select('id, role')
        .eq('userId', user.id)
        .eq('householdId', householdId)
        .maybeSingle();

    if (membershipError) { return NextResponse.json({ error: 'Error verifying household membership', details: membershipError.message }, { status: 500 });}
    if (!householdUser) { return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 }); }
    console.log('[Tasks API] User membership verified, role:', householdUser.role);


    const taskId = generateUUID();
    const now = new Date().toISOString();
    const formattedDueDate = dueDate ? new Date(dueDate).toISOString() : null;

    // Prepare task data for insertion
    const taskData = {
         id: taskId,
         title,
         description: description || null,
         status: status || 'PENDING',
         priority: priority || 'MEDIUM',
         creatorId: user.id,
         assigneeId: assigneeId || null,
         dueDate: formattedDueDate,
         recurring: !!recurring,
         recurrenceRule: recurrenceRule || null,
         householdId,
         createdAt: now,
         updatedAt: now,
         completedAt: status === 'COMPLETED' ? now : null
    };

    // Use the 'supabase' instance from the helper
     const { data: newTask, error: createError } = await supabase
        .from('Task')
        .insert(taskData)
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
    if (!newTask) {
        console.error('[Tasks API] Task creation did not return data.');
        return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }

    console.log('[Tasks API] Task created successfully:', newTask.id);
    return NextResponse.json(newTask, { status: 201 });

  } catch (error) {
     console.error('[Tasks API] Unhandled error in POST /api/tasks:', error);
     const message = error instanceof Error ? error.message : 'Unknown error';
     return NextResponse.json({ error: 'Failed to create task', details: message }, { status: 500 });
  }
}

// PATCH /api/tasks?taskId={taskId} - Update a task
export async function PATCH(request: NextRequest) {
   console.log('[Tasks API] PATCH /api/tasks - Starting handler');
   try {
      // Use the imported standardized helper
      const supabase = await createServerSupabaseClient();

      // Use getUser()
      console.log('[Tasks API] Getting authenticated user');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      // Add explicit error handling for getUser
      if (userError) {
            console.error('[Tasks API] Auth getUser error:', userError);
            return NextResponse.json({ error: 'Authentication error', details: userError.message }, { status: 401 });
      }
      if (!user) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });}
      console.log('[Tasks API] User authenticated as:', user.id);

      const { searchParams } = new URL(request.url);
      const taskId = searchParams.get('taskId');
      if (!taskId) { return NextResponse.json({ error: 'Task ID query parameter is required' }, { status: 400 });}

      let data;
      try { data = await request.json(); } catch (e) { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });}

      // Verify task exists and get householdId and creatorId
      // Use the 'supabase' instance from the helper
      const { data: existingTask, error: taskFetchError } = await supabase
          .from('Task')
          .select('id, creatorId, householdId, assigneeId')
          .eq('id', taskId)
          .maybeSingle();

      if (taskFetchError) {
            console.error('[Tasks API] Error fetching task for update:', taskFetchError);
            return NextResponse.json({ error: 'Failed to fetch task for update', details: taskFetchError.message }, { status: 500 });
       }
      if (!existingTask) { return NextResponse.json({ error: 'Task not found' }, { status: 404 });}

      // Check membership using user.id
      // Use the 'supabase' instance from the helper
       const { data: membership, error: membershipError } = await supabase
          .from('HouseholdUser')
          .select('userId, role')
          .eq('userId', user.id)
          .eq('householdId', existingTask.householdId)
          .maybeSingle();

       if (membershipError) { return NextResponse.json({ error: 'Error verifying household membership', details: membershipError.message }, { status: 500 });}
       if (!membership) { return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });}
       console.log('[Tasks API] User membership verified, role:', membership.role);

      // Check permissions (creator, admin, or potentially assignee can update)
      const isCreator = existingTask.creatorId === user.id;
      const isAdmin = membership.role === 'ADMIN';
      const isAssignee = existingTask.assigneeId === user.id;

      if (!isCreator && !isAdmin && !isAssignee) {
           console.log(`[Tasks API] Permission denied for user ${user.id} on task ${taskId}. IsCreator: ${isCreator}, IsAdmin: ${isAdmin}, IsAssignee: ${isAssignee}`);
           return NextResponse.json({ error: 'You do not have permission to update this task' }, { status: 403 });
       }

      // --- Corrected updateData definition and assignment ---
      const updateData: {
          updatedAt: string;
          title?: string;
          description?: string | null;
          status?: string;
          priority?: string;
          assigneeId?: string | null;
          dueDate?: string | null;
          recurring?: boolean;
          recurrenceRule?: string | null;
          completedAt?: string | null;
      } = {
          updatedAt: new Date().toISOString(),
          completedAt: null // Initialize completedAt
      };

      // Map optional fields from request body 'data'
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.priority !== undefined) updateData.priority = data.priority;
      if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId;
      if (data.dueDate !== undefined) {
           updateData.dueDate = data.dueDate ? new Date(data.dueDate).toISOString() : null;
      }
      if (data.recurring !== undefined) updateData.recurring = !!data.recurring;
      if (data.recurrenceRule !== undefined) updateData.recurrenceRule = data.recurrenceRule;

       // Set completedAt based on status
       // Use the 'supabase' instance from the helper
       const finalStatus = updateData.status !== undefined ? updateData.status : (await supabase.from('Task').select('status').eq('id', taskId).single()).data?.status;

       if (finalStatus === 'COMPLETED') {
           // Use the 'supabase' instance from the helper
           const currentCompletedAt = (await supabase.from('Task').select('completedAt').eq('id', taskId).single()).data?.completedAt;
           if (!currentCompletedAt) {
               updateData.completedAt = new Date().toISOString();
           } else {
               delete updateData.completedAt;
           }
       } else {
            updateData.completedAt = null;
       }
       // --- End corrected block ---

      // Use the 'supabase' instance from the helper
       const { data: updatedTask, error: updateError } = await supabase
          .from('Task')
          .update(updateData)
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
      if (!updatedTask) {
          console.error('[Tasks API] Task update failed or task not found after update.');
          return NextResponse.json({ error: 'Task update failed or task not found after update' }, { status: 500 });
      }

      console.log('[Tasks API] Task updated successfully');
      return NextResponse.json(updatedTask);

   } catch (error) {
      console.error('[Tasks API] Unhandled error in PATCH /api/tasks:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json({ error: 'Failed to update task', details: message }, { status: 500 });
   }
}

// DELETE /api/tasks?taskId={taskId} - Delete a task
export async function DELETE(request: NextRequest) {
   console.log('[Tasks API] DELETE /api/tasks - Starting handler');
   try {
      // Use the imported standardized helper
      const supabase = await createServerSupabaseClient();

      // Use getUser()
      console.log('[Tasks API] Getting authenticated user');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
       // Add explicit error handling for getUser
       if (userError) {
            console.error('[Tasks API] Auth getUser error:', userError);
            return NextResponse.json({ error: 'Authentication error', details: userError.message }, { status: 401 });
       }
      if (!user) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });}
      console.log('[Tasks API] User authenticated as:', user.id);

      const { searchParams } = new URL(request.url);
      const taskId = searchParams.get('taskId');
      if (!taskId) { return NextResponse.json({ error: 'Task ID query parameter is required' }, { status: 400 });}

      // Verify task exists and get householdId and creatorId
      // Use the 'supabase' instance from the helper
      const { data: existingTask, error: taskFetchError } = await supabase
          .from('Task')
          .select('id, creatorId, householdId')
          .eq('id', taskId)
          .maybeSingle();

       if (taskFetchError) {
            console.error('[Tasks API] Error fetching task for deletion:', taskFetchError);
            return NextResponse.json({ error: 'Failed to fetch task for deletion', details: taskFetchError.message }, { status: 500 });
       }
      if (!existingTask) { return NextResponse.json({ error: 'Task not found' }, { status: 404 });}

      // Check membership using user.id
      // Use the 'supabase' instance from the helper
      const { data: membership, error: membershipError } = await supabase
          .from('HouseholdUser')
          .select('userId, role')
          .eq('userId', user.id)
          .eq('householdId', existingTask.householdId)
          .maybeSingle();

      if (membershipError) { return NextResponse.json({ error: 'Error verifying household membership', details: membershipError.message }, { status: 500 });}
      if (!membership) { return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });}
      console.log('[Tasks API] User membership verified, role:', membership.role);

      // Check permissions (creator or admin can delete)
      const isCreator = existingTask.creatorId === user.id;
      const isAdmin = membership.role === 'ADMIN';
      if (!isCreator && !isAdmin) { return NextResponse.json({ error: 'You do not have permission to delete this task' }, { status: 403 }); }

      // Delete the task
      // Use the 'supabase' instance from the helper
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
      const message = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json({ error: 'Failed to delete task', details: message }, { status: 500 });
   }
}