// src/app/api/households/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// GET /api/households - Get all households for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get all households the user is a member of
    const householdUsers = await prisma.householdUser.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        household: {
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
            _count: {
              select: {
                expenses: true,
                tasks: true,
                messages: true,
                rules: true,
              },
            },
          },
        },
      },
      orderBy: {
        joinedAt: 'desc',
      },
    });
    
    // Format the response
    const households = householdUsers.map((hu: { household: { id: any; name: any; address: any; createdAt: any; updatedAt: any; members: any[]; _count: { expenses: any; tasks: any; messages: any; rules: any; }; }; role: any; joinedAt: any; }) => ({
      id: hu.household.id,
      name: hu.household.name,
      address: hu.household.address,
      createdAt: hu.household.createdAt,
      updatedAt: hu.household.updatedAt,
      role: hu.role,
      joinedAt: hu.joinedAt,
      memberCount: hu.household.members.length,
      expenseCount: hu.household._count.expenses,
      taskCount: hu.household._count.tasks,
      messageCount: hu.household._count.messages,
      ruleCount: hu.household._count.rules,
      // Add simplified member list (first 5 members)
      members: hu.household.members.slice(0, 5).map(m => ({
        id: m.user.id,
        name: m.user.name,
        avatar: m.user.avatar,
        role: m.role,
      })),
    }));
    
    return NextResponse.json(households);
  } catch (error) {
    console.error('Error fetching households:', error);
    return NextResponse.json({ error: 'Failed to fetch households' }, { status: 500 });
  }
}

// POST /api/households - Create a new household
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { name, address } = await request.json();
    
    // Validate input
    if (!name) {
      return NextResponse.json({ error: 'Household name is required' }, { status: 400 });
    }
    
    // Create the household and add the current user as an admin
    const household = await prisma.household.create({
      data: {
        name,
        address,
        members: {
          create: {
            userId: session.user.id,
            role: 'ADMIN',
          },
        },
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
      },
    });
    
    return NextResponse.json(household, { status: 201 });
  } catch (error) {
    console.error('Error creating household:', error);
    return NextResponse.json({ error: 'Failed to create household' }, { status: 500 });
  }
}