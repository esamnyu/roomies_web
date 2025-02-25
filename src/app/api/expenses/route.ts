// src/app/api/expenses/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// GET /api/expenses
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get household ID from query params
    const { searchParams } = new URL(request.url);
    const householdId = searchParams.get('householdId');
    
    if (!householdId) {
      return NextResponse.json({ error: 'Household ID is required' }, { status: 400 });
    }
    
    // Check if user is a member of the household
    const householdUser = await prisma.householdUser.findUnique({
      where: {
        userId_householdId: {
          userId: session.user.id,
          householdId: householdId,
        },
      },
    });
    
    if (!householdUser) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    // Fetch all expenses for the household
    const expenses = await prisma.expense.findMany({
      where: {
        householdId: householdId,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        splits: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        payments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: 'desc',
      },
    });
    
    return NextResponse.json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

// POST /api/expenses
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const data = await request.json();
    const { 
      title, 
      amount, 
      date, 
      description, 
      splitType, 
      householdId, 
      splits 
    } = data;
    
    // Validate required fields
    if (!title || !amount || !date || !splitType || !householdId || !splits || !splits.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Check if user is a member of the household
    const householdUser = await prisma.householdUser.findUnique({
      where: {
        userId_householdId: {
          userId: session.user.id,
          householdId: householdId,
        },
      },
    });
    
    if (!householdUser) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    // Create the expense with splits and payments
    const expense = await prisma.expense.create({
      data: {
        title,
        amount,
        date: new Date(date),
        description,
        splitType,
        householdId,
        creatorId: session.user.id,
        splits: {
          create: splits.map((split: any) => ({
            userId: split.userId,
            amount: split.amount,
            percentage: split.percentage || null,
          })),
        },
        payments: {
          create: splits
            .filter((split: any) => split.userId !== session.user.id) // Don't create a payment for the creator
            .map((split: any) => ({
              userId: split.userId,
              amount: split.amount,
              status: 'PENDING',
            })),
        },
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        splits: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
        payments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                avatar: true,
              },
            },
          },
        },
      },
    });
    
    return NextResponse.json(expense);
  } catch (error) {
    console.error('Error creating expense:', error);
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}