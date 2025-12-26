// src/app/(dashboard)/tasks/page.tsx
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import TasksClientPage from '@/components/tasks/TasksClientPage'

// Interface for the props expected by TasksClientPage
interface ClientMember {
  id: string;
  name: string;
  avatar?: string;
}

export default async function TasksPage() {
  // Create server-side Supabase client
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch (error) {
            // Handle potential errors during cookie setting
          }
        },
      },
    }
  )

  // Get the current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md">
          You must be logged in to view tasks.
        </div>
      </div>
    )
  }

  // Get user's current household
  const { data: householdUser, error: householdError } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false })
    .limit(1)
    .single()

  if (householdError || !householdUser) {
    console.error("Household fetch error:", householdError);
    return (
      <div className="container mx-auto py-6 px-4">
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md">
          Could not find your household. Please make sure you belong to a household. {householdError?.message}
        </div>
      </div>
    )
  }

  // Get household members for task assignments
  const { data: membersData, error: membersError } = await supabase
    .from('household_members')
    .select(`
      user_id,
      user:profiles!user_id(
        id,
        name,
        avatar_url
      )
    `)
    .eq('household_id', householdUser.household_id)

  if (membersError) {
    console.error("Members fetch error:", membersError);
  }

  // Map members data to expected format
  const members: ClientMember[] = (membersData || [])
    .map((member: any): ClientMember | null => {
      if (!member?.user) {
        console.warn(`Missing user data for user_id: ${member?.user_id}`);
        return null;
      }
      return {
        id: member.user.id,
        name: member.user.name || 'Unknown',
        avatar: member.user.avatar_url ?? undefined
      };
    })
    .filter((member): member is ClientMember => member !== null);

  // Pre-fetch initial chores/tasks for the household
  const { data: initialChores, error: choresError } = await supabase
    .from('household_chores')
    .select(`
      id,
      name,
      description,
      is_core_chore,
      is_active,
      frequency,
      frequency_days,
      allocation_mode,
      single_owner_id,
      task_type,
      default_scheduled_time,
      created_at,
      updated_at,
      single_owner:profiles!single_owner_id(id, name, avatar_url)
    `)
    .eq('household_id', householdUser.household_id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (choresError) {
    console.error("Chores fetch error:", choresError);
  }

  // Also fetch chore assignments for this household
  const { data: assignments, error: assignmentsError } = await supabase
    .from('chore_assignments')
    .select(`
      id,
      household_chore_id,
      assigned_user_id,
      cycle_start_date,
      due_date,
      status,
      completed_at,
      notes,
      scheduled_time,
      is_task,
      chore:household_chores!household_chore_id(id, name, description)
    `)
    .eq('household_id', householdUser.household_id)
    .in('status', ['pending', 'completed'])
    .order('due_date', { ascending: true })

  if (assignmentsError) {
    console.error("Assignments fetch error:", assignmentsError);
  }

  // Transform chores to match expected task format for TasksClientPage
  const initialTasks = (initialChores || []).map((chore: any) => ({
    id: chore.id,
    title: chore.name,
    description: chore.description,
    status: 'PENDING' as const, // Default status
    priority: (chore.is_core_chore ? 'HIGH' : 'MEDIUM') as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT',
    dueDate: undefined, // Chores don't have individual due dates, assignments do
    householdId: householdUser.household_id,
    creatorId: chore.single_owner_id || user.id,
    creatorName: chore.single_owner?.name,
    assigneeId: chore.single_owner_id,
    assigneeName: chore.single_owner?.name,
    // Required field - determine if recurring based on frequency
    recurring: chore.frequency !== 'once' && chore.frequency !== null,
    recurrenceRule: chore.frequency,
  }));

  // Pass the data to the client component
  return (
    <TasksClientPage
      initialTasks={initialTasks}
      members={members}
      householdId={householdUser.household_id}
      currentUserId={user.id}
    />
  )
}
