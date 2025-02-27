// src/app/api/payments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// GET /api/payments - Get all payments for a user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const householdId = searchParams.get('householdId');
    const expenseId = searchParams.get('expenseId');
    
    // Build query filters
    const filters: any = {
      userId: session.user.id,
    };
    
    // Add optional filters
    if (status) {
      filters.status = status;
    }
    
    if (expenseId) {
      filters.expenseId = expenseId;
    }
    
    if (householdId) {
      filters.expense = {
        householdId: householdId,
      };
    }
    
    // Get payments for the current user
    const payments = await prisma.payment.findMany({
      where: filters,
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
      orderBy: [
        {
          status: 'asc', // PENDING first, then COMPLETED, then DECLINED
        },
        {
          createdAt: 'desc',
        },
      ],
    });
    
    return NextResponse.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 });
  }
}

// POST /api/payments - Create a new payment
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { expenseId, userId, amount, status = 'PENDING' } = await request.json();
    
    // Validate required fields
    if (!expenseId || !userId || amount === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Check if the expense exists and get the household info
    const expense = await prisma.expense.findUnique({
      where: {
        id: expenseId,
      },
      include: {
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
    });
    
    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }
    
    // Check if the user is a member of the household that the expense belongs to
    if (expense.household.members.length === 0) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    // Only the expense creator or an admin can create payments for others
    const isCreator = expense.creatorId === session.user.id;
    const isAdmin = expense.household.members[0].role === 'ADMIN';
    
    if (!isCreator && !isAdmin && userId !== session.user.id) {
      return NextResponse.json({ 
        error: 'You can only create payments for yourself unless you are the expense creator or an admin' 
      }, { status: 403 });
    }
    
    // Check if a payment already exists for this user and expense
    const existingPayment = await prisma.payment.findFirst({
      where: {
        expenseId,
        userId,
      },
    });
    
    if (existingPayment) {
      return NextResponse.json({ 
        error: 'A payment for this expense and user already exists' 
      }, { status: 400 });
    }
    
    // Create the payment
    const payment = await prisma.payment.create({
      data: {
        expenseId,
        userId,
        amount,
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
                avatar: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
      },
    });
    
    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    console.error('Error creating payment:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}