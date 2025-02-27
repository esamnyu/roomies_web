// src/app/api/households/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// GET /api/households/[id] - Get a specific household
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const householdId = params.id;
    
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
    
    // Get the household with related data
    const household = await prisma.household.findUnique({
      where: {
        id: householdId,
      },
      include: {
        members: {
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
        expenses: {
          orderBy: {
            date: 'desc',
          },
          take: 5, // Only include recent expenses
        },
        tasks: {
          where: {
            status: {
              not: 'COMPLETED',
            },
          },
          orderBy: [
            {
              priority: 'desc',
            },
            {
              dueDate: 'asc',
            },
          ],
          take: 5, // Only include important pending tasks
        },
        messages: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 10, // Only include recent messages
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
        },
        rules: true,
      },
    });
    
    if (!household) {
      return NextResponse.json({ error: 'Household not found' }, { status: 404 });
    }
    
    return NextResponse.json(household);
  } catch (error) {
    console.error('Error fetching household:', error);
    return NextResponse.json({ error: 'Failed to fetch household' }, { status: 500 });
  }
}

// PATCH /api/households/[id] - Update a specific household
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const householdId = params.id;
    const data = await request.json();
    
    // Check if user is an admin of the household
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
    
    if (householdUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only household admins can update household information' }, { status: 403 });
    }
    
    // Extract the fields we want to update
    const { name, address } = data;
    
    // Validate required fields
    if (name !== undefined && name.trim() === '') {
      return NextResponse.json({ error: 'Household name cannot be empty' }, { status: 400 });
    }
    
    // Prepare update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    
    // Update the household
    const updatedHousehold = await prisma.household.update({
      where: {
        id: householdId,
      },
      data: updateData,
    });
    
    return NextResponse.json(updatedHousehold);
  } catch (error) {
    console.error('Error updating household:', error);
    return NextResponse.json({ error: 'Failed to update household' }, { status: 500 });
  }
}

// DELETE /api/households/[id] - Delete a specific household
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const householdId = params.id;
    
    // Check if user is an admin of the household
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
    
    if (householdUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only household admins can delete a household' }, { status: 403 });
    }
    
    // Count the number of members in the household
    const membersCount = await prisma.householdUser.count({
      where: {
        householdId: householdId,
      },
    });
    
    // If there are other members, prevent deletion
    if (membersCount > 1) {
      return NextResponse.json({ 
        error: 'Cannot delete a household with active members. Remove all members first or transfer admin rights.' 
      }, { status: 400 });
    }
    
    // Delete the household - this should cascade delete all related records
    await prisma.household.delete({
      where: {
        id: householdId,
      },
    });
    
    return NextResponse.json({ message: 'Household deleted successfully' });
  } catch (error) {
    console.error('Error deleting household:', error);
    return NextResponse.json({ error: 'Failed to delete household' }, { status: 500 });
  }
}

// POST /api/households/[id]/members - Add a member to the household
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const householdId = params.id;
    const { email, role = 'MEMBER' } = await request.json();
    
    // Check if the current user is a member and admin of the household
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
    
    if (householdUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only household admins can add members' }, { status: 403 });
    }
    
    // Find the user by email
    const user = await prisma.user.findUnique({
      where: {
        email,
      },
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Check if the user is already a member of the household
    const existingMember = await prisma.householdUser.findUnique({
      where: {
        userId_householdId: {
          userId: user.id,
          householdId: householdId,
        },
      },
    });
    
    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member of this household' }, { status: 400 });
    }
    
    // Add the user to the household
    const newMember = await prisma.householdUser.create({
      data: {
        userId: user.id,
        householdId: householdId,
        role: role as 'ADMIN' | 'MEMBER' | 'GUEST',
      },
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
    });
    
    // TODO: In a real app, send an invitation email or notification to the user
    
    return NextResponse.json(newMember);
  } catch (error) {
    console.error('Error adding household member:', error);
    return NextResponse.json({ error: 'Failed to add household member' }, { status: 500 });
  }
}

// Additional household member management APIs

// PATCH /api/households/[id]/members/[userId] - Update a member's role
export async function PATCH_MEMBER(
  request: NextRequest,
  { params }: { params: { id: string, userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id: householdId, userId } = params;
    const { role } = await request.json();
    
    // Check if the current user is a member and admin of the household
    const currentUserMembership = await prisma.householdUser.findUnique({
      where: {
        userId_householdId: {
          userId: session.user.id,
          householdId: householdId,
        },
      },
    });
    
    if (!currentUserMembership) {
      return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
    }
    
    if (currentUserMembership.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only household admins can update member roles' }, { status: 403 });
    }
    
    // Prevent changing your own role (to avoid removing the last admin)
    if (userId === session.user.id) {
      return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 });
    }
    
    // Update the member's role
    const updatedMember = await prisma.householdUser.update({
      where: {
        userId_householdId: {
          userId: userId,
          householdId: householdId,
        },
      },
      data: {
        role: role as 'ADMIN' | 'MEMBER' | 'GUEST',
      },
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
    });
    
    return NextResponse.json(updatedMember);
  } catch (error) {
    console.error('Error updating member role:', error);
    return NextResponse.json({ error: 'Failed to update member role' }, { status: 500 });
  }
}

// DELETE /api/households/[id]/members/[userId] - Remove a member from the household
export async function DELETE_MEMBER(
  request: NextRequest,
  { params }: { params: { id: string, userId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id: householdId, userId } = params;
    
    // User can remove themselves, or admins can remove others
    const isCurrentUser = userId === session.user.id;
    
    if (!isCurrentUser) {
      // Check if the current user is a member and admin of the household
      const currentUserMembership = await prisma.householdUser.findUnique({
        where: {
          userId_householdId: {
            userId: session.user.id,
            householdId: householdId,
          },
        },
      });
      
      if (!currentUserMembership) {
        return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
      }
      
      if (currentUserMembership.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Only household admins can remove members' }, { status: 403 });
      }
    }
    
    // Check if the user to be removed is an admin
    const memberToRemove = await prisma.householdUser.findUnique({
      where: {
        userId_householdId: {
          userId: userId,
          householdId: householdId,
        },
      },
    });
    
    if (!memberToRemove) {
      return NextResponse.json({ error: 'Member not found in the household' }, { status: 404 });
    }
    
    // If removing an admin, check if they're the last admin
    if (memberToRemove.role === 'ADMIN') {
      const adminCount = await prisma.householdUser.count({
        where: {
          householdId: householdId,
          role: 'ADMIN',
        },
      });
      
      if (adminCount <= 1) {
        return NextResponse.json({ 
          error: 'Cannot remove the last admin. Assign another admin first.' 
        }, { status: 400 });
      }
    }
    
    // Remove the household member
    await prisma.householdUser.delete({
      where: {
        userId_householdId: {
          userId: userId,
          householdId: householdId,
        },
      },
    });
    
    return NextResponse.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Error removing household member:', error);
    return NextResponse.json({ error: 'Failed to remove household member' }, { status: 500 });
  }
}