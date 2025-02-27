// src/app/api/payments/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// GET /api/payments/[id] - Get a specific payment
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const paymentId = params.id;
    
    // Get the payment with related data
    const payment = await prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
      include: {
        expense: {
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
            household: {
              select: {
                id: true,
                name: true,
                members: {
                  where: {
                    userId: session.user.id,
                  },
                },
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });
    
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }
    
    // Check if the user is a member of the household that the payment belongs to
    if (payment.expense.household.members.length === 0) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    return NextResponse.json(payment);
  } catch (error) {
    console.error('Error fetching payment:', error);
    return NextResponse.json({ error: 'Failed to fetch payment' }, { status: 500 });
  }
}

// PATCH /api/payments/[id] - Update payment status
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const paymentId = params.id;
    const { status } = await request.json();
    
    // Validate status
    if (!status || !['PENDING', 'COMPLETED', 'DECLINED'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
    }
    
    // Get the payment to check permissions
    const payment = await prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
      include: {
        expense: {
          include: {
            creator: {
              select: {
                id: true,
              },
            },
            household: {
              include: {
                members: {
                  where: {
                    userId: session.user.id,
                  },
                },
              },
            },
          },
        },
      },
    });
    
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }
    
    // Check if the user is a member of the household
    if (payment.expense.household.members.length === 0) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    // Determine who is allowed to update this payment
    const isPaymentUser = payment.userId === session.user.id;
    const isExpenseCreator = payment.expense.creatorId === session.user.id;
    const isAdmin = payment.expense.household.members[0]?.role === 'ADMIN';
    
    // Payment user can update their own payment
    // Expense creator can update payments for their expense
    // Admins can update any payment in their household
    if (!isPaymentUser && !isExpenseCreator && !isAdmin) {
      return NextResponse.json({ 
        error: 'You are not authorized to update this payment' 
      }, { status: 403 });
    }
    
    // If user is marking their own payment as COMPLETED, additional validation
    if (isPaymentUser && status === 'COMPLETED' && !isExpenseCreator && !isAdmin) {
      // In a real app, you might want to add payment verification logic here
      // For example, check if they've uploaded proof of payment or connected to a payment processor
    }
    
    // Update the payment
    const updatedPayment = await prisma.payment.update({
      where: {
        id: paymentId,
      },
      data: {
        status,
        date: status === 'COMPLETED' ? new Date() : null,
      },
      include: {
        expense: {
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });
    
    return NextResponse.json(updatedPayment);
  } catch (error) {
    console.error('Error updating payment:', error);
    return NextResponse.json({ error: 'Failed to update payment' }, { status: 500 });
  }
}

// DELETE /api/payments/[id] - Delete a payment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const paymentId = params.id;
    
    // Get the payment to check permissions
    const payment = await prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
      include: {
        expense: {
          include: {
            creator: {
              select: {
                id: true,
              },
            },
            household: {
              include: {
                members: {
                  where: {
                    userId: session.user.id,
                  },
                },
              },
            },
          },
        },
      },
    });
    
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }
    
    // Check if the user is a member of the household
    if (payment.expense.household.members.length === 0) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    // Only expense creator or admin can delete a payment
    const isExpenseCreator = payment.expense.creatorId === session.user.id;
    const isAdmin = payment.expense.household.members[0]?.role === 'ADMIN';
    
    if (!isExpenseCreator && !isAdmin) {
      return NextResponse.json({ 
        error: 'Only the expense creator or a household admin can delete a payment' 
      }, { status: 403 });
    }
    
    // Prevent deleting COMPLETED payments in a real system
    // For demo purposes, we'll allow it with a warning
    if (payment.status === 'COMPLETED') {
      // In a real app, you might want to prevent this or add an audit log
      console.warn('Deleting a COMPLETED payment! This should be carefully audited.');
    }
    
    // Delete the payment
    await prisma.payment.delete({
      where: {
        id: paymentId,
      },
    });
    
    return NextResponse.json({ message: 'Payment deleted successfully' });
  } catch (error) {
    console.error('Error deleting payment:', error);
    return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
  }
}

// POST /api/payments/[id]/remind - Send a reminder for a pending payment
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Check if the route is for a reminder
    const pathname = request.nextUrl.pathname;
    if (!pathname.endsWith('/remind')) {
      return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
    }
    
    const paymentId = params.id;
    
    // Get the payment to check permissions
    const payment = await prisma.payment.findUnique({
      where: {
        id: paymentId,
      },
      include: {
        expense: {
          include: {
            creator: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            household: {
              include: {
                members: {
                  where: {
                    userId: session.user.id,
                  },
                },
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
    
    if (!payment) {
      return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    }
    
    // Check if the user is a member of the household
    if (payment.expense.household.members.length === 0) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    // Only expense creator or admin can send reminders
    const isExpenseCreator = payment.expense.creatorId === session.user.id;
    const isAdmin = payment.expense.household.members[0]?.role === 'ADMIN';
    
    if (!isExpenseCreator && !isAdmin) {
      return NextResponse.json({ 
        error: 'Only the expense creator or a household admin can send payment reminders' 
      }, { status: 403 });
    }
    
    // Check if the payment is still pending
    if (payment.status !== 'PENDING') {
      return NextResponse.json({ 
        error: 'Cannot send a reminder for a non-pending payment' 
      }, { status: 400 });
    }
    
    // In a real app, you would send an email or notification here
    
    // Instead of tracking lastReminderSent (which isn't in our schema),
    // we'll simply touch the payment record to update its updatedAt timestamp
    const updatedPayment = await prisma.payment.update({
      where: {
        id: paymentId,
      },
      data: {
        // Just update the existing record to modify the updatedAt timestamp
        // We could add a proper lastReminderSent field to the schema in a real app
        status: payment.status, // Set to its current value (no change)
      },
    });
    
    // Here you would integrate with your email service or notification system
    // For example:
    // await sendPaymentReminder({
    //   to: payment.user.email,
    //   name: payment.user.name,
    //   amount: payment.amount,
    //   expenseTitle: payment.expense.title,
    //   expenseCreator: payment.expense.creator.name,
    // });
    
    // Create a reminder activity or event record (in a real app)
    // await prisma.activityLog.create({
    //   data: {
    //     type: 'PAYMENT_REMINDER',
    //     userId: session.user.id,
    //     targetUserId: payment.userId,
    //     householdId: payment.expense.householdId,
    //     paymentId: payment.id,
    //     expenseId: payment.expenseId,
    //   }
    // });
    
    return NextResponse.json({ 
      message: 'Payment reminder sent successfully',
      reminderSent: updatedPayment.updatedAt,
    });
  } catch (error) {
    console.error('Error sending payment reminder:', error);
    return NextResponse.json({ error: 'Failed to send payment reminder' }, { status: 500 });
  }
}