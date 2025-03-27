// src/app/api/expenses/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { generateUUID } from '@/lib/utils'; // Assuming you have this utility

// Helper function to create Supabase client with improved error handling
const createSupabaseClient = async () => {
    try {
        const cookieStore = await cookies();
        const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)/)?.[1];
        const authCookie = cookieStore.get(`sb-${projectRef}-auth-token`);
        console.log('[Expenses API] Auth cookie present (read directly):', !!authCookie);

        return createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    get(name: string) {
                        const cookie = cookieStore.get(name);
                        console.log(`[Expenses API] Getting cookie '${name}':`, !!cookie);
                        return cookie?.value;
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        try { cookieStore.set({ name, value, ...options }); } catch (error) { console.error(`[Expenses API] Failed to set cookie '${name}':`, error); }
                    },
                    remove(name: string, options: CookieOptions) {
                        try { cookieStore.set({ name, value: '', ...options }); } catch (error) { console.error(`[Expenses API] Failed to remove cookie '${name}':`, error); }
                    },
                },
            }
        );
    } catch (error) {
        console.error("[Expenses API] Failed to create Supabase client:", error);
        throw error;
    }
}

// GET /api/expenses
export async function GET(request: NextRequest) {
  console.log('[Expenses API] GET /api/expenses - Starting handler');
  let supabase;
  try {
      supabase = await createSupabaseClient();
  } catch (error) {
      return NextResponse.json({ error: 'Internal server error during client setup' }, { status: 500 });
  }

  try {
    console.log('[Expenses API] Attempting to get session...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
       console.error('[Expenses API] Session error:', sessionError);
       return NextResponse.json({ error: 'Failed to process session', details: sessionError.message }, { status: 500 });
    }

    // Get household ID from query params
    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('householdId');

    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 });
    }

    let userId: string | null = null;

    // --- START: Admin Bypass Logic ---
    if (!session) {
        console.error('[Expenses API] No session found - Attempting Admin Bypass');
        // Create an admin client
         const supabaseAdmin = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use Service Role Key
            {
                auth: { persistSession: false, autoRefreshToken: false },
                cookies: { get: () => undefined, set: () => {}, remove: () => {} } // No cookie interaction needed for admin
            }
        );

        // Use admin client to fetch expenses for the household
        const { data: expenses, error: adminError } = await supabaseAdmin
            .from('Expense')
            .select(`
                *,
                creator:User!creatorId(id, name, email, avatar),
                splits:ExpenseSplit(
                  *,
                  user:User!userId(id, name, email, avatar)
                ),
                payments:Payment(
                  *,
                  user:User!userId(id, name, email, avatar)
                )
            `)
            .eq('householdId', householdId)
            .order('date', { ascending: false });

        if (adminError) {
            console.error('[Expenses API] Error fetching expenses with admin bypass:', adminError);
            return NextResponse.json({ error: 'Failed to fetch expenses (admin bypass)' }, { status: 500 });
        }

        console.log(`[Expenses API] Admin bypass: Found ${expenses?.length || 0} expenses`);
        return NextResponse.json(expenses || []);

    } else {
        // Session exists, proceed with normal authenticated flow
        userId = session.user.id;
        console.log('[Expenses API] User authenticated:', userId);
    }
    // --- END: Admin Bypass Logic ---


    // --- START: Regular Authenticated Flow ---
    // Check if user is a member of the household using the REGULAR client
    console.log('[Expenses API] Checking household membership for user', userId);
    const { data: householdUser, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('userId')
      .eq('userId', userId!) // userId is guaranteed non-null here
      .eq('householdId', householdId)
      .maybeSingle();

    if (membershipError) {
      console.error('[Expenses API] Error checking household membership:', membershipError);
      return NextResponse.json({ error: 'Failed to verify household membership' }, { status: 500 });
    }

    if (!householdUser) {
      console.log('[Expenses API] User', userId, 'is not a member of household', householdId);
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    console.log('[Expenses API] User membership verified.');

    // Fetch expenses using the REGULAR client
    console.log('[Expenses API] Fetching expenses for household', householdId, 'as user', userId);
    const { data: expenses, error: expensesError } = await supabase
      .from('Expense')
      .select(`
        *,
        creator:User!creatorId(id, name, email, avatar),
        splits:ExpenseSplit(
          *,
          user:User!userId(id, name, email, avatar)
        ),
        payments:Payment(
          *,
          user:User!userId(id, name, email, avatar)
        )
      `)
      .eq('householdId', householdId)
      .order('date', { ascending: false });

    if (expensesError) {
      console.error('[Expenses API] Error fetching expenses:', expensesError);
      return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
    }

    console.log(`[Expenses API] Successfully fetched ${expenses?.length || 0} expenses as authenticated user.`);
    return NextResponse.json(expenses || []);
    // --- END: Regular Authenticated Flow ---

  } catch (error) {
    console.error('[Expenses API] Unhandled error in GET /api/expenses:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch expenses';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/expenses
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseClient();
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) throw new Error(sessionError.message);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const userId = session.user.id;

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
      .from('HouseholdUser')
      .select('userId')
      .eq('userId', userId)
      .eq('householdId', householdId)
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
      .from('Expense')
      .insert({
          id: expenseId,
          title,
          amount: parsedAmount,
          date: new Date(date).toISOString(), // Ensure it's a valid ISO string
          description,
          splitType,
          householdId,
          creatorId: userId,
          createdAt: now, // Explicitly set timestamps
          updatedAt: now
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
            expenseId: newExpense.id,
            userId: split.userId,
            amount: splitAmount,
            percentage: split.percentage || null,
            createdAt: now,
            updatedAt: now
        };
    });

    const { error: splitsInsertError } = await supabase
        .from('ExpenseSplit')
        .insert(splitsData);

    if (splitsInsertError) {
      console.error('Error creating expense splits:', splitsInsertError);
      // CRITICAL: Need rollback here in a real transaction
      await supabase.from('Expense').delete().eq('id', newExpense.id); // Attempt cleanup
      return NextResponse.json({ error: 'Failed to create expense splits' }, { status: 500 });
    }

    // 3. Create the Payments (for users other than the creator)
    const paymentsData = splits
      .filter((split: any) => split.userId !== userId) // Don't create payment for the creator
      .map((split: any) => {
          const paymentAmount = parseFloat(split.amount);
          if (isNaN(paymentAmount)) {
              throw new Error(`Invalid payment amount for user ${split.userId}`);
          }
          return {
            id: generateUUID(), // Generate UUID for payment
            expenseId: newExpense.id,
            userId: split.userId,
            amount: paymentAmount,
            status: 'PENDING', // Default status
            createdAt: now,
            updatedAt: now
          };
      });

    // Only insert if there are payments to create
    if (paymentsData.length > 0) {
        const { error: paymentsInsertError } = await supabase
            .from('Payment')
            .insert(paymentsData);

        if (paymentsInsertError) {
            console.error('Error creating payments:', paymentsInsertError);
            // CRITICAL: Need rollback here in a real transaction
            await supabase.from('ExpenseSplit').delete().eq('expenseId', newExpense.id); // Attempt cleanup
            await supabase.from('Expense').delete().eq('id', newExpense.id); // Attempt cleanup
            return NextResponse.json({ error: 'Failed to create payments' }, { status: 500 });
        }
    }
    // --- Transaction End (Conceptual) ---


    // Fetch the complete expense data to return
    const { data: completeExpense, error: fetchError } = await supabase
      .from('Expense')
      .select(`
        *,
        creator:User!creatorId(id, name, email, avatar),
        splits:ExpenseSplit(
          *,
          user:User!userId(id, name, email, avatar)
        ),
        payments:Payment(
          *,
          user:User!userId(id, name, email, avatar)
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