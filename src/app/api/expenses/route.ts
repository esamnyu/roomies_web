// src/app/api/expenses/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { generateUUID } from '@/lib/utils'; // Assuming you have a UUID generator

// Helper function to create Supabase client in Route Handlers
async function createSupabaseRouteHandlerClient() {
  const cookieStore = await cookies();
  return createServerClient(
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
  );
}


// GET /api/expenses
export async function GET(request: NextRequest) {
  const supabase = await createSupabaseRouteHandlerClient();
  try {
    // Use getUser() instead of getSession() for better security
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Auth error:', userError?.message || 'No user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    // Get household ID from query params (accept both camelCase and snake_case)
    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('household_id') || searchParams.get('householdId');

    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 });
    }

    // Check if user is a member of the household using Supabase
    const { data: householdUser, error: membershipError } = await supabase
      .from('household_members')
      .select('user_id') // Select only necessary field
      .eq('user_id', userId)
      .eq('household_id', householdId)
      .maybeSingle(); // Use maybeSingle to handle no membership found

    if (membershipError) {
      console.error('Error checking household membership:', membershipError);
      return NextResponse.json({ error: 'Failed to verify household membership' }, { status: 500 });
    }

    if (!householdUser) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }

    // Fetch all expenses for the household using Supabase
    const { data: expenses, error: expensesError } = await supabase
      .from('expenses')
      .select(`
        *,
        paid_by_user:profiles!paid_by(id, name, email, avatar_url),
        created_by_user:profiles!created_by(id, name, email, avatar_url),
        splits:expense_splits(
          *,
          user:profiles!user_id(id, name, email, avatar_url)
        )
      `)
      .eq('household_id', householdId)
      .order('date', { ascending: false });

    if (expensesError) {
      console.error('Error fetching expenses:', expensesError);
      return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
    }

    return NextResponse.json(expenses || []); // Return empty array if null

  } catch (error) {
    console.error('Error in GET /api/expenses:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch expenses';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/expenses
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseRouteHandlerClient();
  try {
    // Use getUser() instead of getSession() for better security
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Auth error:', userError?.message || 'No user found');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = user.id;

    const body = await request.json();
    const {
      title,
      amount,
      date, // Expecting ISO string format e.g., "2025-03-26T15:45:00.000Z"
      description,
      splitType,
      householdId,
      splits // Expecting array: [{ userId: string, amount: number, percentage?: number | null }, ...]
    } = body;

    // Validate required fields
    if (!title || !amount || !date || !splitType || !householdId || !splits || !splits.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate amount
     const parsedAmount = parseFloat(amount);
     if (isNaN(parsedAmount) || parsedAmount <= 0) {
        return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
     }


    // Check if user is a member of the household using Supabase
    const { data: householdUser, error: membershipError } = await supabase
      .from('household_members')
      .select('user_id')
      .eq('user_id', userId)
      .eq('household_id', householdId)
      .maybeSingle();

    if (membershipError) {
      console.error('Error checking household membership:', membershipError);
      return NextResponse.json({ error: 'Failed to verify household membership' }, { status: 500 });
    }

    if (!householdUser) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }

    // --- Transaction Start (Conceptual - Use Supabase Function for real transaction) ---
    // 1. Create the Expense
    const expenseId = generateUUID(); // Generate ID beforehand
    const now = new Date().toISOString();

    const { data: newExpense, error: expenseInsertError } = await supabase
      .from('expenses')
      .insert({
          id: expenseId,
          description: title || description, // Use title as description (expenses table has description, not title)
          amount: parsedAmount,
          date: new Date(date).toISOString(), // Ensure it's a valid ISO string
          household_id: householdId,
          paid_by: userId,
          created_by: userId,
          created_at: now, // Explicitly set timestamps
          updated_at: now
      })
      .select('id') // Select only the ID
      .single();

    if (expenseInsertError || !newExpense) {
      console.error('Error creating expense:', expenseInsertError);
      // Optional: Attempt rollback if possible (difficult without transaction)
      return NextResponse.json({ error: 'Failed to create expense record' }, { status: 500 });
    }

    // 2. Create the Expense Splits
    const splitsData = splits.map((split: any) => {
        const splitAmount = parseFloat(split.amount);
        if (isNaN(splitAmount)) {
            throw new Error(`Invalid split amount for user ${split.userId}`);
        }
        return {
            id: generateUUID(), // Generate UUID for split
            expense_id: newExpense.id,
            user_id: split.userId,
            amount: splitAmount,
            settled: false,
            created_at: now,
            updated_at: now
        };
    });

    const { error: splitsInsertError } = await supabase
        .from('expense_splits')
        .insert(splitsData);

    if (splitsInsertError) {
      console.error('Error creating expense splits:', splitsInsertError);
      // CRITICAL: Need rollback here in a real transaction
      await supabase.from('expenses').delete().eq('id', newExpense.id); // Attempt cleanup
      return NextResponse.json({ error: 'Failed to create expense splits' }, { status: 500 });
    }
    // --- Transaction End (Conceptual) ---


    // Fetch the complete expense data to return
    const { data: completeExpense, error: fetchError } = await supabase
      .from('expenses')
      .select(`
        *,
        paid_by_user:profiles!paid_by(id, name, email, avatar_url),
        created_by_user:profiles!created_by(id, name, email, avatar_url),
        splits:expense_splits(
          *,
          user:profiles!user_id(id, name, email, avatar_url)
        )
      `)
      .eq('id', newExpense.id)
      .single();

      if (fetchError || !completeExpense) {
          console.error('Failed to fetch newly created expense:', fetchError);
          // Don't error out the whole request, return basic success info
          return NextResponse.json({
                message: "Expense created, but failed to fetch full details",
                expenseId: newExpense.id
          }, { status: 201 });
      }


    return NextResponse.json(completeExpense, { status: 201 });

  } catch (error) {
    console.error('Error in POST /api/expenses:', error);
    const message = error instanceof Error ? error.message : 'Failed to create expense';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}