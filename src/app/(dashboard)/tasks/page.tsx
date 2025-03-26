// src/app/(dashboard)/tasks/page.tsx
import { createServerClient, type CookieOptions } from '@supabase/ssr' 
import { cookies } from 'next/headers'
import TasksClientPage from '@/components/tasks/TasksClientPage' // Assuming this is the correct path

// Interface for the data structure expected from the Supabase query
interface SupabaseMemberData {
  userId: string;
  user: {
    id: string;
    name: string;
    avatar: string | null; // Supabase might return null
  } | null; 
}

// Interface for the props expected by TasksClientPage
interface ClientMember {
  id: string;
  name: string;
  avatar?: string; // Matches TasksClientPageProps expectation (string | undefined)
}

export default async function TasksPage() {
  // Create server-side Supabase client
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) { 
          // @ts-ignore - Workaround for potential Next.js cookie type mismatch
          cookieStore.set({ name, value, ...options }) 
        },
        remove(name: string, options: CookieOptions) { 
          // @ts-ignore - Workaround for potential Next.js cookie type mismatch
          cookieStore.set({ name, value: '', ...options })
        },
      },
    }
  )
  
  // Get the current user's session
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    // Handle logged-out state
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
    .from('HouseholdUser')
    .select('householdId')
    .eq('userId', session.user.id)
    .order('joinedAt', { ascending: false })
    .limit(1)
    .single()
  
  if (householdError || !householdUser) {
     console.error("Household fetch error:", householdError); 
    // Handle missing household state
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
    .from('HouseholdUser')
    .select(`
      userId,
      user:userId(
        id,
        name,
        avatar
      )
    `)
    .eq('householdId', householdUser.householdId)

  if (membersError) {
     console.error("Members fetch error:", membersError);
     // Handle member fetch error - proceeding with empty list
  }
  
  // ---- FIXES APPLIED BELOW ----
  // 1. Assert the type of membersData more forcefully.
  // 2. Map null avatar to undefined to match TasksClientPage prop type.
  const members: ClientMember[] = (membersData as SupabaseMemberData[] | null) // Assert type here
    ?.map((member): ClientMember | null => { 
      // Safety check remains important
      if (!member?.user) {
        console.warn(`Missing user data for userId: ${member?.userId}`);
        return null; 
      }
      return {
        id: member.user.id,
        name: member.user.name,
        // Convert null avatar to undefined
        avatar: member.user.avatar ?? undefined 
      };
    })
    .filter((member): member is ClientMember => member !== null) || []; // Filter out nulls
  // ---- END OF FIXES ----
  
  // Pre-fetch initial tasks for the household
  const { data: initialTasks, error: tasksError } = await supabase
    .from('Task')
    .select(`
      *,
      creator:creatorId(id, name, avatar),
      assignee:assigneeId(id, name, avatar)
    `)
    .eq('householdId', householdUser.householdId)
    .order('priority', { ascending: false })
    .order('dueDate', { ascending: true })

  if (tasksError) {
      console.error("Tasks fetch error:", tasksError);
      // Handle task fetch error - proceeding with empty list
  }
  
  // Pass the data to the client component
  return (
    <TasksClientPage 
      initialTasks={initialTasks || []}
      members={members} // Pass the correctly typed and filtered members array
      householdId={householdUser.householdId}
      currentUserId={session.user.id}
    />
  )
}