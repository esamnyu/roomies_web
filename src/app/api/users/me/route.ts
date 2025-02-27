// src/app/api/users/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// GET /api/users/me - Get current user's details
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get the current user with related data
    const user = await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        createdAt: true,
        // Note: User model doesn't have a metadata field
        // In a real app, you would include a settings field or join with a UserSettings model
        households: {
          include: {
            household: {
              select: {
                id: true,
                name: true,
                address: true,
                createdAt: true,
              },
            },
          },
          orderBy: {
            joinedAt: 'desc',
          },
        },
        // Get counts for related data that exists in the schema
        // These counts may vary based on your actual schema
        _count: {
          select: {
            // Use only relations that actually exist in your Prisma schema
            // For example, if these don't exist, use what's available
            payments: true,
            // We'll omit fields that don't exist in your schema
          },
        }
      },
    });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    // Format user data for response without using non-existent fields
    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
      createdAt: user.createdAt,
      // In a real app, this would come from a settings field or UserSettings model
      settings: {
        theme: 'system', // Default values since we don't have actual storage
        notifications: {
          email: true,
          push: true,
          expenses: true,
          tasks: true
        },
        privacy: {
          showEmail: false,
          showStatus: true,
        },
        preferences: {
          currency: 'USD',
          dateFormat: 'MM/DD/YYYY',
          language: 'en',
        }
      },
      // Provide basic activity stats based on available data
      statistics: {
        // Use only what's available in the _count field
        payments: user._count?.payments || 0,
        // For missing stats, provide zeros or omit them
        // If you need other stats, you would add them here
      },
      households: user.households.map(membership => ({
        id: membership.household.id,
        name: membership.household.name,
        address: membership.household.address,
        createdAt: membership.household.createdAt,
        joinedAt: membership.joinedAt,
        role: membership.role,
      })),
    };
    
    return NextResponse.json(userData);
  } catch (error) {
    console.error('Error fetching current user:', error);
    return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
  }
}

// DELETE /api/users/me - Delete current user's account
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // First, check the user's households and roles
    const userHouseholds = await prisma.householdUser.findMany({
      where: {
        userId: session.user.id,
        role: 'ADMIN',
      },
      include: {
        household: {
          include: {
            _count: {
              select: {
                members: true,
              },
            },
          },
        },
      },
    });
    
    // Check if user is the sole admin of any households
    const soleAdminHouseholds = await Promise.all(userHouseholds.map(async (membership) => {
      if (membership.role === 'ADMIN' && membership.household._count.members > 1) {
        // Count other admins in this household
        const otherAdminsCount = await prisma.householdUser.count({
          where: {
            householdId: membership.householdId,
            role: 'ADMIN',
            userId: {
              not: session.user.id,
            },
          },
        });
        
        if (otherAdminsCount === 0) {
          return membership.household.name;
        }
      }
      return null;
    }));
    
    // Filter out null values and get households where user is the sole admin
    const problematicHouseholds = soleAdminHouseholds.filter(Boolean);
    
    if (problematicHouseholds.length > 0) {
      return NextResponse.json({ 
        error: 'You are the only admin of one or more households. Please transfer admin rights or delete these households first.',
        households: problematicHouseholds,
      }, { status: 400 });
    }
    
    // Begin transaction to delete the user and related data
    await prisma.$transaction(async (prisma) => {
      // First, remove user from all households they're a member of
      await prisma.householdUser.deleteMany({
        where: {
          userId: session.user.id,
        },
      });
      
      // Delete payments created by or for this user
      await prisma.payment.deleteMany({
        where: {
          userId: session.user.id,
        },
      });
      
      // Reassign or delete tasks created by this user
      // For simplicity, we'll delete them, but you could add logic to reassign
      await prisma.task.deleteMany({
        where: {
          creatorId: session.user.id,
        },
      });
      
      // Unassign tasks assigned to this user
      await prisma.task.updateMany({
        where: {
          assigneeId: session.user.id,
        },
        data: {
          assigneeId: null,
        },
      });
      
      // Delete expenses created by this user
      // Note: In a real app, you might want to handle this differently
      await prisma.expense.deleteMany({
        where: {
          creatorId: session.user.id,
        },
      });
      
      // Delete expense splits and related payments for this user
      await prisma.expenseSplit.deleteMany({
        where: {
          userId: session.user.id,
        },
      });
      
      // Finally, delete the user
      await prisma.user.delete({
        where: {
          id: session.user.id,
        },
      });
    });
    
    return NextResponse.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Error deleting user account:', error);
    return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 });
  }
}