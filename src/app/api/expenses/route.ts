// src/app/api/expenses/route.ts
import { NextRequest, NextResponse } from 'next/server';
// Removed Prisma import
// import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
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
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // Handle potential errors during cookie setting (e.g., read-only headers)
            console.error("Error setting cookie:", name, error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // Handle potential errors during cookie removal
            console.error("Error removing cookie:", name, error);
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
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) throw new Error(sessionError.message); // Or handle more gracefully
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;

    // Get household ID from query params
    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('householdId');

    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 });
    }

    // Check if user is a member of the household using Supabase
    const { data: householdUser, error: membershipError } = await supabase
      .from('HouseholdUser')
      .select('userId') // Select only necessary field
      .eq('userId', userId)
      .eq('householdId', householdId)
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