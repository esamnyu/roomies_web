// src/app/api/tasks/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// GET /api/tasks/[id] - Get a specific task
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const taskId = params.id;
    
    // Get the task
    const task = await prisma.task.findUnique({
      where: {
        id: taskId,
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
        household: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    // Check if the user is a member of the household that the task belongs to
    const householdUser = await prisma.householdUser.findUnique({
      where: {
        userId_householdId: {
          userId: session.user.id,
          householdId: task.householdId,
        },
      },
    });
    
    if (!householdUser) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    return NextResponse.json(task);
  } catch (error) {
    console.error('Error fetching task:', error);
    return NextResponse.json({ error: 'Failed to fetch task' }, { status: 500 });
  }
}

// PATCH /api/tasks/[id] - Update a specific task
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const taskId = params.id;
    const data = await request.json();
    
    // Get the current task to verify permissions
    const currentTask = await prisma.task.findUnique({
      where: {
        id: taskId,
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
    
    if (!currentTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    // Check if user is a member of the household
    if (currentTask.household.members.length === 0) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    // Check if the user is the creator, assignee, or an admin of the household
    const isCreator = currentTask.creatorId === session.user.id;
    const isAssignee = currentTask.assigneeId === session.user.id;
    const isAdmin = currentTask.household.members[0].role === 'ADMIN';
    
    if (!isCreator && !isAssignee && !isAdmin) {
      return NextResponse.json({ 
        error: 'You are not authorized to update this task' 
      }, { status: 403 });
    }
    
    // Extract the data we want to update
    const { 
      title, 
      description, 
      status, 
      priority, 
      assigneeId, 
      dueDate, 
      recurring, 
      recurrenceRule 
    } = data;
    
    // Prepare the update data
    const updateData: any = {};
    
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) {
      updateData.status = status;
      
      // If the task is being marked as completed, set the completedAt date
      if (status === 'COMPLETED' && currentTask.status !== 'COMPLETED') {
        updateData.completedAt = new Date();
      } 
      // If the task is being un-completed, remove the completedAt date
      else if (status !== 'COMPLETED' && currentTask.status === 'COMPLETED') {
        updateData.completedAt = null;
      }
    }
    if (priority !== undefined) updateData.priority = priority;
    if (assigneeId !== undefined) updateData.assigneeId = assigneeId;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (recurring !== undefined) updateData.recurring = recurring;
    if (recurrenceRule !== undefined) updateData.recurrenceRule = recurrenceRule;
    
    // Update the task
    const updatedTask = await prisma.task.update({
      where: {
        id: taskId,
      },
      data: updateData,
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
    
    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

// DELETE /api/tasks/[id] - Delete a specific task
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const taskId = params.id;
    
    // Get the task to verify permissions
    const task = await prisma.task.findUnique({
      where: {
        id: taskId,
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
    
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    
    // Check if user is a member of the household
    if (task.household.members.length === 0) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    // Check if the user is the creator or an admin of the household
    const isCreator = task.creatorId === session.user.id;
    const isAdmin = task.household.members[0].role === 'ADMIN';
    
    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: 'You are not authorized to delete this task' }, { status: 403 });
    }
    
    // Delete the task
    await prisma.task.delete({
      where: {
        id: taskId,
      },
    });
    
    return NextResponse.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}