// src/app/api/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// GET /api/tasks
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
    
    // Fetch all tasks for the household
    const tasks = await prisma.task.findMany({
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
        assignee: {
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
          priority: 'desc', // URGENT, HIGH, MEDIUM, LOW
        },
        {
          dueDate: 'asc', // Earlier dates first
        },
      ],
    });
    
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
  }
}

// POST /api/tasks
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const data = await request.json();
    const { 
      title, 
      description, 
      status, 
      priority, 
      assigneeId, 
      dueDate, 
      recurring, 
      recurrenceRule, 
      householdId 
    } = data;
    
    // Validate required fields
    if (!title || !householdId) {
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
    
    // Create the task
    const task = await prisma.task.create({
      data: {
        title,
        description,
        status: status || 'PENDING',
        priority: priority || 'MEDIUM',
        creatorId: session.user.id,
        assigneeId,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        recurring: recurring || false,
        recurrenceRule,
        householdId,
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
        assignee: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
      },
    });
    
    return NextResponse.json(task);
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}