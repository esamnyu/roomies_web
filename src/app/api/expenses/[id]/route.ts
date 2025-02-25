// src/app/api/expenses/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// GET /api/expenses/[id] - Get a specific expense
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const expenseId = params.id;
    
    // Get the expense
    const expense = await prisma.expense.findUnique({
      where: {
        id: expenseId,
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
        household: {
          select: {
            id: true,
            name: true,
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
    
    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }
    
    // Check if the user is a member of the household that the expense belongs to
    const householdUser = await prisma.householdUser.findUnique({
      where: {
        userId_householdId: {
          userId: session.user.id,
          householdId: expense.householdId,
        },
      },
    });
    
    if (!householdUser) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    return NextResponse.json(expense);
  } catch (error) {
    console.error('Error fetching expense:', error);
    return NextResponse.json({ error: 'Failed to fetch expense' }, { status: 500 });
  }
}

// PATCH /api/expenses/[id] - Update a specific expense
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const expenseId = params.id;
    const data = await request.json();
    
    // Get the current expense to verify permissions
    const currentExpense = await prisma.expense.findUnique({
      where: {
        id: expenseId,
      },
    });
    
    if (!currentExpense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }
    
    // Only the creator can update the expense
    if (currentExpense.creatorId !== session.user.id) {
      return NextResponse.json({ error: 'You are not authorized to update this expense' }, { status: 403 });
    }
    
    // Check if the user is a member of the household
    const householdUser = await prisma.householdUser.findUnique({
      where: {
        userId_householdId: {
          userId: session.user.id,
          householdId: currentExpense.householdId,
        },
      },
    });
    
    if (!householdUser) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    // Extract the basic expense fields
    const { 
      title, 
      amount, 
      date, 
      description, 
      splitType,
      splits,
      payments
    } = data;
    
    // Update the expense
    const updatedExpense = await prisma.$transaction(async (prisma: { expense: { update: (arg0: { where: { id: string; }; data: { title: any; amount: any; date: Date | undefined; description: any; splitType: any; }; }) => any; findUnique: (arg0: { where: { id: string; }; include: { creator: { select: { id: boolean; name: boolean; email: boolean; avatar: boolean; }; }; splits: { include: { user: { select: { id: boolean; name: boolean; email: boolean; avatar: boolean; }; }; }; }; payments: { include: { user: { select: { id: boolean; name: boolean; email: boolean; avatar: boolean; }; }; }; }; }; }) => any; }; expenseSplit: { deleteMany: (arg0: { where: { expenseId: string; }; }) => any; createMany: (arg0: { data: any; }) => any; }; payment: { upsert: (arg0: { where: { id: any; }; update: { amount: any; status: any; date: Date | null; }; create: { expenseId: string; userId: any; amount: any; status: any; date: Date | null; }; }) => any; }; }) => {
      // Update the base expense
      const expense = await prisma.expense.update({
        where: {
          id: expenseId,
        },
        data: {
          title,
          amount,
          date: date ? new Date(date) : undefined,
          description,
          splitType,
        },
      });
      
      // If splits are provided, update them
      if (splits && splits.length > 0) {
        // Delete existing splits
        await prisma.expenseSplit.deleteMany({
          where: {
            expenseId,
          },
        });
        
        // Create new splits
        await prisma.expenseSplit.createMany({
          data: splits.map((split: any) => ({
            expenseId,
            userId: split.userId,
            amount: split.amount,
            percentage: split.percentage || null,
          })),
        });
      }
      
      // If payments are provided, update them
      if (payments && payments.length > 0) {
        // Handle each payment individually to preserve status
        for (const payment of payments) {
          await prisma.payment.upsert({
            where: {
              id: payment.id || 'new-payment', // Use a placeholder if new
            },
            update: {
              amount: payment.amount,
              status: payment.status,
              date: payment.status === 'COMPLETED' ? new Date() : null,
            },
            create: {
              expenseId,
              userId: payment.userId,
              amount: payment.amount,
              status: payment.status,
              date: payment.status === 'COMPLETED' ? new Date() : null,
            },
          });
        }
      }
      
      // Return the updated expense with all relations
      return prisma.expense.findUnique({
        where: {
          id: expenseId,
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
    });
    
    return NextResponse.json(updatedExpense);
  } catch (error) {
    console.error('Error updating expense:', error);
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
  }
}

// DELETE /api/expenses/[id] - Delete a specific expense
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const expenseId = params.id;
    
    // Get the current expense to verify permissions
    const expense = await prisma.expense.findUnique({
      where: {
        id: expenseId,
      },
    });
    
    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }
    
    // Check if the user is the creator or an admin of the household
    const householdUser = await prisma.householdUser.findUnique({
      where: {
        userId_householdId: {
          userId: session.user.id,
          householdId: expense.householdId,
        },
      },
    });
    
    const isCreator = expense.creatorId === session.user.id;
    const isAdmin = householdUser?.role === 'ADMIN';
    
    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: 'You are not authorized to delete this expense' }, { status: 403 });
    }
    
    // Delete the expense (cascade will handle related records)
    await prisma.expense.delete({
      where: {
        id: expenseId,
      },
    });
    
    return NextResponse.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}