// src/app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr'; // Ensure CookieOptions is imported
import { cookies } from 'next/headers';
import { generateUUID } from '@/lib/utils'; // Assuming you have this utility

// --- Helper function to create client (or import if you centralize it) ---
// Consider moving this to a shared lib file if used in many routes
const createSupabaseClient = async () => {
    // Removed 'async' as cookies() is not directly awaited here,
    // but createServerClient handles the async nature internally
    const cookieStore = await cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) { return cookieStore.get(name)?.value },
                // Add try-catch for robustness, although might mask underlying issues
                set(name: string, value: string, options: CookieOptions) {
                   try { cookieStore.set({ name, value, ...options }); } catch (error) { console.error(`Failed to set cookie '${name}':`, error); }
                 },
                remove(name: string, options: CookieOptions) {
                   try { cookieStore.set({ name, value: '', ...options }); } catch (error) { console.error(`Failed to remove cookie '${name}':`, error); }
                 },
            },
        }
    );
}


// GET /api/tasks - Get all tasks for a household or a single task
export async function GET(request: NextRequest) {
  console.log('[Tasks API] GET /api/tasks - Starting handler');
  try {
    const supabase = await createSupabaseClient(); // Use helper

    // Use getUser() to check authentication
    console.log('[Tasks API] Getting authenticated user');
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError) {
      console.error('[Tasks API] Auth getUser error:', userError);
      // Don't expose detailed error messages unless necessary
      return NextResponse.json({ error: 'Authentication error' }, { status: 401 });
    }
    if (!user) {
      console.log('[Tasks API] No authenticated user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.log('[Tasks API] User authenticated:', user.id);

    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('household_id');
    const taskId = searchParams.get('taskId'); // Renamed from 'id' in original code to 'taskId' for clarity

     if (!householdId && !taskId) {
        return NextResponse.json({ error: 'Either householdId or taskId query parameter is required' }, { status: 400 });
    }

    // --- Fetch Single Task ---
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
          .maybeSingle(); // Use maybeSingle to handle not found gracefully

        if (taskError) {
          console.error('[Tasks API] Error fetching single task:', taskError);
          return NextResponse.json({ error: 'Failed to fetch task', details: taskError.message }, { status: 500 });
        }
        if (!task) {
          console.log('[Tasks API] Task not found:', taskId);
          return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        // Add a check: Ensure the user belongs to the task's household
         const { data: taskMembership, error: taskMembershipError } = await supabase
             .from('household_members')
             .select('id') // Only need to check existence
             .eq('user_id', user.id)
             .eq('household_id', task.householdId) // Assuming task object has householdId
             .limit(1) // Optimization
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
      const { data: householdUser, error: membershipError } = await supabase
        .from('household_members')
        .select('id, role') // Select role if needed later
        .eq('user_id', user.id)
        .eq('household_id', householdId)
        .maybeSingle(); // Use maybeSingle

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
       const { data: tasks, error: tasksError } = await supabase
          .from('Task')
          .select(`
              *,
              creator:creatorId(id, name, email, avatar),
              assignee:assigneeId(id, name, email, avatar)
          `)
          .eq('household_id', householdId)
          .order('priority', { ascending: false }) // Consider if priority is string or number for correct ordering
          .order('dueDate', { ascending: true, nullsFirst: false }); // Keep tasks without due date last

       if (tasksError) {
            console.error('[Tasks API] Error fetching tasks:', tasksError);
            return NextResponse.json({ error: 'Failed to fetch tasks', details: tasksError.message }, { status: 500 });
        }
       console.log('[Tasks API] Successfully fetched', tasks?.length || 0, 'tasks');
       return NextResponse.json(tasks || []); // Return empty array if null
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
    const supabase = await createSupabaseClient(); // Use helper

    // Use getUser()
    console.log('[Tasks API] Getting authenticated user');
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError) { return NextResponse.json({ error: 'Authentication error' }, { status: 401 }); }
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
    const { data: householdUser, error: membershipError } = await supabase
        .from('household_members')
        .select('id, role')
        .eq('user_id', user.id)
        .eq('household_id', householdId)
        .maybeSingle(); // Use maybeSingle

    if (membershipError) { return NextResponse.json({ error: 'Error verifying household membership', details: membershipError.message }, { status: 500 });}
    if (!householdUser) { return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 }); }
    console.log('[Tasks API] User membership verified, role:', householdUser.role);


    const taskId = generateUUID();
    const now = new Date().toISOString();
    const formattedDueDate = dueDate ? new Date(dueDate).toISOString() : null; // Ensure date is valid or null

    // Prepare task data for insertion
    const taskData = {
         id: taskId,
         title,
         description: description || null, // Ensure null if empty/undefined
         status: status || 'PENDING',
         priority: priority || 'MEDIUM',
         creatorId: user.id, // Use user.id here
         assigneeId: assigneeId || null, // Ensure null if empty/undefined
         dueDate: formattedDueDate,
         recurring: !!recurring, // Ensure boolean
         recurrenceRule: recurrenceRule || null, // Ensure null if empty/undefined
         householdId,
         created_at: now,
         updated_at: now,
         completedAt: status === 'COMPLETED' ? now : null // Set completedAt if created as completed
    };

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
        // Should not happen if insert is successful, but check
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
      const supabase = await createSupabaseClient(); // Use helper

      // Use getUser()
      console.log('[Tasks API] Getting authenticated user');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });}
      console.log('[Tasks API] User authenticated as:', user.id);

      const { searchParams } = new URL(request.url);
      const taskId = searchParams.get('taskId'); // Use 'taskId' for consistency
      if (!taskId) { return NextResponse.json({ error: 'Task ID query parameter is required' }, { status: 400 });}

      let data;
      try { data = await request.json(); } catch (e) { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });}

      // Verify task exists and get householdId and creatorId
      const { data: existingTask, error: taskFetchError } = await supabase
          .from('Task')
          .select('id, creatorId, householdId, assigneeId') // Select assigneeId if needed for permissions
          .eq('id', taskId)
          .maybeSingle(); // Use maybeSingle

      if (taskFetchError) {
            console.error('[Tasks API] Error fetching task for update:', taskFetchError);
            return NextResponse.json({ error: 'Failed to fetch task for update', details: taskFetchError.message }, { status: 500 });
       }
      if (!existingTask) { return NextResponse.json({ error: 'Task not found' }, { status: 404 });}

      // Check membership using user.id
       const { data: membership, error: membershipError } = await supabase
          .from('household_members')
          .select('userId, role') // Select role for admin check
          .eq('user_id', user.id)
          .eq('household_id', existingTask.householdId)
          .maybeSingle(); // Use maybeSingle

       if (membershipError) { return NextResponse.json({ error: 'Error verifying household membership', details: membershipError.message }, { status: 500 });}
       if (!membership) { return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });}
       console.log('[Tasks API] User membership verified, role:', membership.role);

      // Check permissions (creator, admin, or potentially assignee can update)
      const isCreator = existingTask.creatorId === user.id;
      const isAdmin = membership.role === 'ADMIN';
      const isAssignee = existingTask.assigneeId === user.id;

      // Define who can update - adjust policy as needed
      // Example: Allow creator, admin, or assignee to update
      if (!isCreator && !isAdmin && !isAssignee) {
           console.log(`[Tasks API] Permission denied for user ${user.id} on task ${taskId}. IsCreator: ${isCreator}, IsAdmin: ${isAdmin}, IsAssignee: ${isAssignee}`);
           return NextResponse.json({ error: 'You do not have permission to update this task' }, { status: 403 });
       }

      // --- Corrected updateData definition and assignment ---
      const updateData: {
          updated_at: string;
          title?: string;
          description?: string | null;
          status?: string;
          priority?: string;
          assigneeId?: string | null;
          dueDate?: string | null;
          recurring?: boolean;
          recurrenceRule?: string | null;
          completedAt?: string | null; // Explicitly include completedAt
      } = {
          updated_at: new Date().toISOString(),
          // Start with null/undefined for potentially updated fields
          completedAt: null
      };

      // Map optional fields from request body 'data'
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.priority !== undefined) updateData.priority = data.priority;
      // Allow unassigning by passing null/undefined for assigneeId
      if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId;
      if (data.dueDate !== undefined) {
           updateData.dueDate = data.dueDate ? new Date(data.dueDate).toISOString() : null;
      }
      if (data.recurring !== undefined) updateData.recurring = !!data.recurring; // Ensure boolean
      if (data.recurrenceRule !== undefined) updateData.recurrenceRule = data.recurrenceRule;


       // Set completedAt based on status AFTER status is potentially updated
       // Use updateData.status if status is part of the update, otherwise fetch existing status if needed
       const finalStatus = updateData.status !== undefined ? updateData.status : (await supabase.from('Task').select('status').eq('id', taskId).single()).data?.status;

       if (finalStatus === 'COMPLETED') {
           // Only set completedAt if it's not already set or if the status is changing TO completed
           const currentCompletedAt = (await supabase.from('Task').select('completedAt').eq('id', taskId).single()).data?.completedAt;
           if (!currentCompletedAt) {
               updateData.completedAt = new Date().toISOString();
           } else {
               // If already completed, don't overwrite completedAt unless specifically intended
               delete updateData.completedAt; // Remove from update payload if not changing
           }
       } else {
            // Ensure completedAt is explicitly nullified if status is not COMPLETED
            updateData.completedAt = null;
       }
       // --- End corrected block ---


       const { data: updatedTask, error: updateError } = await supabase
          .from('Task')
          .update(updateData) // Pass the fully typed object
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
      const supabase = await createSupabaseClient(); // Use helper

      // Use getUser()
      console.log('[Tasks API] Getting authenticated user');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });}
      console.log('[Tasks API] User authenticated as:', user.id);

      const { searchParams } = new URL(request.url);
      const taskId = searchParams.get('taskId'); // Use 'taskId'
      if (!taskId) { return NextResponse.json({ error: 'Task ID query parameter is required' }, { status: 400 });}

      // Verify task exists and get householdId and creatorId
      const { data: existingTask, error: taskFetchError } = await supabase
          .from('Task')
          .select('id, creatorId, householdId')
          .eq('id', taskId)
          .maybeSingle(); // Use maybeSingle

       if (taskFetchError) {
            console.error('[Tasks API] Error fetching task for deletion:', taskFetchError);
            return NextResponse.json({ error: 'Failed to fetch task for deletion', details: taskFetchError.message }, { status: 500 });
       }
      if (!existingTask) { return NextResponse.json({ error: 'Task not found' }, { status: 404 });}

      // Check membership using user.id
      const { data: membership, error: membershipError } = await supabase
          .from('household_members')
          .select('userId, role') // Select role for admin check
          .eq('user_id', user.id)
          .eq('household_id', existingTask.householdId)
          .maybeSingle(); // Use maybeSingle

      if (membershipError) { return NextResponse.json({ error: 'Error verifying household membership', details: membershipError.message }, { status: 500 });}
      if (!membership) { return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });}
      console.log('[Tasks API] User membership verified, role:', membership.role);

      // Check permissions (creator or admin can delete)
      const isCreator = existingTask.creatorId === user.id;
      const isAdmin = membership.role === 'ADMIN';
      if (!isCreator && !isAdmin) { return NextResponse.json({ error: 'You do not have permission to delete this task' }, { status: 403 }); }

      // Delete the task
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