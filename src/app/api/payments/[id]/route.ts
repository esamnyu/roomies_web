// src/app/api/payments/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
// Removed Prisma import
// import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { generateUUID } from '@/lib/utils'; // Assuming you have this

// Helper function (same as in expenses route)
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
          try { cookieStore.set({ name, value, ...options }); } catch (error) { console.error("Error setting cookie:", name, error); }
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }); } catch (error) { console.error("Error removing cookie:", name, error); }
        },
      },
    }
  );
}

// --- Helper Function to Check Permissions ---
// Returns { allowed: boolean, paymentData?: any, membership?: any, error?: string, status?: number }
async function checkPaymentPermissions(supabase: any, paymentId: string, userId: string) {
    // 1. Fetch Payment with related Expense and Creator
    const { data: paymentData, error: paymentError } = await supabase
      .from('Payment')
      .select(`
        *,
        expense:Expense!inner(
            id,
            creatorId,
            householdId
        )
      `)
      .eq('id', paymentId)
      .single();

    if (paymentError) {
      console.error("Error fetching payment for permission check:", paymentError);
      return { allowed: false, error: 'Failed to fetch payment data.', status: 500 };
    }
    if (!paymentData) {
      return { allowed: false, error: 'Payment not found.', status: 404 };
    }

    // 2. Check if user is member of the household associated with the expense
    const { data: membership, error: membershipError } = await supabase
        .from('HouseholdUser')
        .select('userId, role')
        .eq('userId', userId)
        .eq('householdId', paymentData.expense.householdId)
        .single();

    if (membershipError) {
        console.error("Error checking household membership:", membershipError);
        return { allowed: false, error: 'Failed to verify household membership.', status: 500 };
    }
    if (!membership) {
        return { allowed: false, error: 'You are not a member of this household.', status: 403 };
    }

    return { allowed: true, paymentData, membership };
}


// GET /api/payments/[id] - Get a specific payment
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createSupabaseRouteHandlerClient();
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw new Error(sessionError.message);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const paymentId = params.id;
    if (!paymentId) return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });

    // Fetch the payment and check household membership in one go
    const { data: payment, error: fetchError } = await supabase
        .from('Payment')
        .select(`
            *,
            expense:Expense!inner(
                *,
                creator:User!creatorId(id, name, email, avatar),
                household:Household!inner(id, name)
            ),
            user:User!userId(id, name, email, avatar)
        `)
        .eq('id', paymentId)
        // Add check to ensure the current user is part of the household
        // This requires knowing the household ID, obtained via the join
        // A direct filter like this might need adjustments based on exact Supabase capabilities or RLS
        // Alternative: Fetch payment, then check membership separately if needed.
        // .eq('expense.household.HouseholdUser.userId', session.user.id) // Example, might not work directly
        .single();


    if (fetchError) {
        console.error('Error fetching payment:', fetchError);
        return NextResponse.json({ error: 'Failed to fetch payment or payment not found' }, { status: 500 }); // Or 404 if appropriate
    }
    if (!payment) {
        return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }

    // Now, explicitly verify membership (more reliable than complex filter)
    const { data: membership, error: membershipError } = await supabase
        .from('HouseholdUser')
        .select('userId')
        .eq('userId', session.user.id)
        .eq('householdId', payment.expense.household.id)
        .maybeSingle();

    if (membershipError) throw membershipError;
    if (!membership) {
        return NextResponse.json({ error: 'You are not authorized to view this payment (not member)' }, { status: 403 });
    }


    return NextResponse.json(payment);
  } catch (error) {
    console.error('Error in GET /api/payments/[id]:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch payment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH /api/payments/[id] - Update payment status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseRouteHandlerClient();
  try {
    const { data: { session }, error: sessionError } = await (await supabase).auth.getSession();
    if (sessionError) throw new Error(sessionError.message);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const paymentId = params.id;
    if (!paymentId) return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });

    const { status } = await request.json();

    // Validate status
    if (!status || !['PENDING', 'COMPLETED', 'DECLINED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status value. Must be PENDING, COMPLETED, or DECLINED' }, { status: 400 });
    }

    // --- Check Permissions ---
    const permCheck = await checkPaymentPermissions(supabase, paymentId, session.user.id);
    if (!permCheck.allowed) {
        return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }
    const { paymentData, membership } = permCheck;

    // Determine who can update
    const isPaymentUser = paymentData.userId === session.user.id;
    const isExpenseCreator = paymentData.expense.creatorId === session.user.id;
    const isAdmin = membership.role === 'ADMIN';

    if (!isPaymentUser && !isExpenseCreator && !isAdmin) {
      return NextResponse.json({ error: 'You are not authorized to update this payment' }, { status: 403 });
    }
    // --- End Check Permissions ---

    // Prepare update data
    const updatePayload: { status: string; date?: string | null, updatedAt: string } = {
        status,
        updatedAt: new Date().toISOString()
    };
    if (status === 'COMPLETED') {
      updatePayload.date = new Date().toISOString();
    } else {
      // Explicitly set date to null if status is not COMPLETED
      updatePayload.date = null;
    }

    // Update the payment in Supabase
    const { data: updatedPayment, error: updateError } = await (await supabase)
      .from('Payment')
      .update(updatePayload)
      .eq('id', paymentId)
      .select(`
         *,
         expense:Expense!inner(
             *,
             creator:User!creatorId(id, name, email, avatar)
         ),
         user:User!userId(id, name, email, avatar)
      `) // Select updated data with relations
      .single();

    if (updateError) {
      console.error('Error updating payment:', updateError);
      return NextResponse.json({ error: 'Failed to update payment status' }, { status: 500 });
    }
     if (!updatedPayment) {
        return NextResponse.json({ error: 'Failed to update payment or payment not found after update' }, { status: 500 });
    }


    return NextResponse.json(updatedPayment);
  } catch (error) {
    console.error('Error in PATCH /api/payments/[id]:', error);
    const message = error instanceof Error ? error.message : 'Failed to update payment';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/payments/[id] - Delete a payment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
    const supabase = createSupabaseRouteHandlerClient();
    try {
      const { data: { session }, error: sessionError } = await (await supabase).auth.getSession();
      if (sessionError) throw new Error(sessionError.message);
      if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const paymentId = params.id;
      if (!paymentId) return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });

      // --- Check Permissions ---
      const permCheck = await checkPaymentPermissions(supabase, paymentId, session.user.id);
      if (!permCheck.allowed) {
          return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
      }
      const { paymentData, membership } = permCheck;

      // Only expense creator or admin can delete
      const isExpenseCreator = paymentData.expense.creatorId === session.user.id;
      const isAdmin = membership.role === 'ADMIN';

      if (!isExpenseCreator && !isAdmin) {
        return NextResponse.json({ error: 'Only the expense creator or a household admin can delete a payment' }, { status: 403 });
      }
       // --- End Check Permissions ---

       // Optional: Add check to prevent deleting COMPLETED payments if needed
       if (paymentData.status === 'COMPLETED') {
           console.warn(`Attempting to delete a COMPLETED payment (ID: ${paymentId}) by user ${session.user.id}.`);
           // Depending on policy, you might return an error here:
           // return NextResponse.json({ error: 'Cannot delete completed payments' }, { status: 400 });
       }


      // Delete the payment
      const { error: deleteError } = await (await supabase)
        .from('Payment')
        .delete()
        .eq('id', paymentId);

      if (deleteError) {
        console.error('Error deleting payment:', deleteError);
        return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
      }

      return NextResponse.json({ message: 'Payment deleted successfully' });

    } catch (error) {
      console.error('Error in DELETE /api/payments/[id]:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete payment';
      return NextResponse.json({ error: message }, { status: 500 });
    }
}

// POST /api/payments/[id]/remind - Send a reminder (Conceptual)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createSupabaseRouteHandlerClient();
  try {
    // Check if the route is specifically for reminders
    const pathname = request.nextUrl.pathname;
     if (!pathname.endsWith('/remind')) {
       // If not a reminder route, handle as potential standard POST if needed, or reject
       // For now, assume only remind uses POST on this specific path pattern
       return NextResponse.json({ error: 'Method Not Allowed or Invalid Endpoint' }, { status: 405 });
     }


    const { data: { session }, error: sessionError } = await (await supabase).auth.getSession();
    if (sessionError) throw new Error(sessionError.message);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const paymentId = params.id;
     if (!paymentId) return NextResponse.json({ error: 'Payment ID is required' }, { status: 400 });

    // --- Check Permissions ---
    const permCheck = await checkPaymentPermissions(supabase, paymentId, session.user.id);
    if (!permCheck.allowed) {
        return NextResponse.json({ error: permCheck.error }, { status: permCheck.status });
    }
    const { paymentData, membership } = permCheck;

    // Only expense creator or admin can send reminders
    const isExpenseCreator = paymentData.expense.creatorId === session.user.id;
    const isAdmin = membership.role === 'ADMIN';

    if (!isExpenseCreator && !isAdmin) {
      return NextResponse.json({ error: 'Only the expense creator or a household admin can send payment reminders' }, { status: 403 });
    }
     // --- End Check Permissions ---

    // Check if the payment is still pending
    if (paymentData.status !== 'PENDING') {
      return NextResponse.json({ error: 'Cannot send a reminder for a non-pending payment' }, { status: 400 });
    }

    // "Send" reminder by updating the updatedAt timestamp
    const { data: updatedPayment, error: updateError } = await (await supabase)
      .from('Payment')
      .update({ updatedAt: new Date().toISOString() }) // Just touch the timestamp
      .eq('id', paymentId)
      .select('updatedAt') // Select only the updated timestamp
      .single();

    if (updateError || !updatedPayment) {
      console.error('Error updating payment timestamp for reminder:', updateError);
      return NextResponse.json({ error: 'Failed to mark reminder (update timestamp)' }, { status: 500 });
    }

    // TODO: Implement actual email/notification sending logic here
    // using paymentData.userId, paymentData.amount, etc.
    console.log(`Reminder logic executed for Payment ID: ${paymentId}. User to remind: ${paymentData.userId}`);


    return NextResponse.json({
        message: 'Payment reminder sent successfully (timestamp updated)',
        reminderSentAt: updatedPayment.updatedAt
    });

  } catch (error) {
    console.error('Error in POST /api/payments/[id]/remind:', error);
    const message = error instanceof Error ? error.message : 'Failed to send reminder';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}