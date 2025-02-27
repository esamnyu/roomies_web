// src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import bcrypt from 'bcrypt';

// GET /api/users - Get list of users (with search and household filtering)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const householdId = searchParams.get('householdId');
    const skip = parseInt(searchParams.get('skip') || '0');
    const take = Math.min(parseInt(searchParams.get('take') || '10'), 50); // Limit max results
    
    // Build query filters
    const filters: any = {};
    
    // Add search filter
    if (search) {
      filters.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    // If filtering by household, check if user is a member
    if (householdId) {
      // Check if user is a member of this household
      const householdUser = await prisma.householdUser.findUnique({
        where: {
          userId_householdId: {
            userId: session.user.id,
            householdId,
          },
        },
      });
      
      if (!householdUser) {
        return NextResponse.json({ error: 'You are not a member of this household' }, { status: 403 });
      }
      
      // Filter users by household membership
      filters.households = {
        some: {
          householdId,
        },
      };
    }
    
    // Get users with pagination
    const users = await prisma.user.findMany({
      where: filters,
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        createdAt: true,
        // Include household information if filtering by household
        ...(householdId ? {
          households: {
            where: {
              householdId,
            },
            select: {
              role: true,
              joinedAt: true,
            },
          },
        } : {}),
      },
      skip,
      take,
      orderBy: {
        name: 'asc',
      },
    });
    
    // Get total count for pagination
    const total = await prisma.user.count({
      where: filters,
    });
    
    return NextResponse.json({
      users,
      pagination: {
        total,
        skip,
        take,
        hasMore: skip + take < total,
      },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

// POST /api/users/settings - Update user settings
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if this is a settings update request
    const pathname = request.nextUrl.pathname;
    
    if (pathname.endsWith('/settings')) {
      const { theme, notifications, privacy, preferences } = await request.json();
      
      // In a real app, you would update user settings in a UserSettings model
      // This is a simplified example - we're just acknowledging the settings update
      // but not actually storing it since our schema doesn't have a metadata field
      
      // To properly implement this in a real application, you would:
      // 1. Add a metadata/settings JSONB field to your User model, OR
      // 2. Create a separate UserSettings model with a one-to-one relation to User
      
      // For now, we'll simulate a successful update without actually storing the data
      
      // Example of how it would be implemented with a dedicated UserSettings model:
      /*
      await prisma.userSettings.upsert({
        where: {
          userId: session.user.id,
        },
        update: {
          settings: JSON.stringify({
            theme,
            notifications,
            privacy,
            preferences,
          }),
        },
        create: {
          userId: session.user.id,
          settings: JSON.stringify({
            theme,
            notifications,
            privacy,
            preferences,
          }),
        },
      });
      */
      
      return NextResponse.json({ 
        message: 'Settings updated successfully',
      });
    }
    
    // Handle other POST endpoints
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  } catch (error) {
    console.error('Error updating user settings:', error);
    return NextResponse.json({ error: 'Failed to update user settings' }, { status: 500 });
  }
}

// PATCH /api/users/profile - Update user profile
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const pathname = request.nextUrl.pathname;
    
    // Handle profile update
    if (pathname.endsWith('/profile')) {
      const { name, email, avatar } = await request.json();
      
      // Validate input
      if (name && name.trim() === '') {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      }
      
      if (email) {
        // Check if email is already taken by another user
        const existingUser = await prisma.user.findFirst({
          where: {
            email,
            id: {
              not: session.user.id,
            },
          },
        });
        
        if (existingUser) {
          return NextResponse.json({ error: 'Email is already in use' }, { status: 400 });
        }
      }
      
      // Update user profile
      const updatedUser = await prisma.user.update({
        where: {
          id: session.user.id,
        },
        data: {
          name: name || undefined,
          email: email || undefined,
          avatar: avatar || undefined,
        },
        select: {
          id: true,
          name: true,
          email: true,
          avatar: true,
        },
      });
      
      return NextResponse.json(updatedUser);
    }
    
    // Handle password update
    if (pathname.endsWith('/password')) {
      const { currentPassword, newPassword } = await request.json();
      
      // Validate passwords
      if (!currentPassword || !newPassword) {
        return NextResponse.json({ error: 'Current password and new password are required' }, { status: 400 });
      }
      
      if (newPassword.length < 8) {
        return NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
      }
      
      // Verify current password
      const user = await prisma.user.findUnique({
        where: {
          id: session.user.id,
        },
        select: {
          password: true,
        },
      });
      
      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      
      if (!isPasswordValid) {
        return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
      }
      
      // Hash the new password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
      
      // Update password
      await prisma.user.update({
        where: {
          id: session.user.id,
        },
        data: {
          password: hashedPassword,
        },
      });
      
      return NextResponse.json({ message: 'Password updated successfully' });
    }
    
    // No matching endpoint
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}