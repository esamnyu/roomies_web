// src/app/(dashboard)/chat/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabaseClient } from '@/lib/supabase';
import { getHouseholdMessages, sendMessage, subscribeToMessages, markMessageAsRead, Message } from '@/lib/chat';
import { areAllChatTablesReady } from '@/lib/databaseReadiness';
import ChatInput from '@/components/chat/ChatInput';
// Define types for mock data
interface MockMessage {
  id: string;
  senderId: string;
  text: string;
  timestamp: Date;
  read: boolean;
}

interface MockConversation {
  messages: MockMessage[];
  lastRead: Date;
}

type MockConversationsType = {
  [key: string]: MockConversation;
};

interface MockMember {
  id: string;
  name: string;
  avatar: string;
  status: 'ONLINE' | 'AWAY' | 'OFFLINE';
}

// Mock data for fallback when database is not ready
const MOCK_MEMBERS: MockMember[] = [
  {
    id: '1',
    name: 'Jane Smith',
    avatar: 'https://i.pravatar.cc/150?img=1',
    status: 'ONLINE',
  },
  {
    id: '2',
    name: 'John Doe',
    avatar: 'https://i.pravatar.cc/150?img=8',
    status: 'AWAY',
  },
  {
    id: '3',
    name: 'Emily Johnson',
    avatar: 'https://i.pravatar.cc/150?img=5',
    status: 'ONLINE',
  },
  {
    id: '4',
    name: 'Michael Brown',
    avatar: 'https://i.pravatar.cc/150?img=12',
    status: 'OFFLINE',
  },
];

const MOCK_CONVERSATIONS: MockConversationsType = {
  'household': {
    messages: [
      {
        id: '1',
        senderId: '3',
        text: 'Hey everyone, just a reminder that rent is due tomorrow!',
        timestamp: new Date('2024-02-25T14:30:00'),
        read: true,
      },
      {
        id: '2',
        senderId: '2',
        text: 'Thanks for the reminder! I will transfer the money tonight.',
        timestamp: new Date('2024-02-25T14:45:00'),
        read: true,
      },
      {
        id: '3',
        senderId: '1',
        text: 'Already paid mine yesterday!',
        timestamp: new Date('2024-02-25T15:10:00'),
        read: true,
      },
      {
        id: '4',
        senderId: '4',
        text: 'I will be paying tomorrow morning, sorry for the delay.',
        timestamp: new Date('2024-02-25T17:23:00'),
        read: false,
      },
    ],
    lastRead: new Date('2024-02-25T15:10:00'),
  },
  '2': {
    messages: [
      {
        id: '1',
        senderId: '2',
        text: 'Hey Jane, do you know where the vacuum is?',
        timestamp: new Date('2024-02-24T10:15:00'),
        read: true,
      },
      {
        id: '2',
        senderId: '1',
        text: 'I think Emily used it last, check the utility closet!',
        timestamp: new Date('2024-02-24T10:25:00'),
        read: true,
      },
    ],
    lastRead: new Date('2024-02-24T10:45:00'),
  },
  '3': {
    messages: [
      {
        id: '1',
        senderId: '3',
        text: 'Hi Jane, are you coming to the house meeting tonight?',
        timestamp: new Date('2024-02-23T18:30:00'),
        read: true,
      },
      {
        id: '2',
        senderId: '1',
        text: 'Yes, I\'ll be there at 7!',
        timestamp: new Date('2024-02-23T18:35:00'),
        read: true,
      },
    ],
    lastRead: new Date('2024-02-23T18:35:00'),
  },
  '4': {
    messages: [
      {
        id: '1',
        senderId: '4',
        text: 'Jane, can I borrow your blender for a smoothie?',
        timestamp: new Date('2024-02-22T09:15:00'),
        read: true,
      },
      {
        id: '2',
        senderId: '1',
        text: 'Sure, it\'s in the cabinet above the fridge!',
        timestamp: new Date('2024-02-22T09:20:00'),
        read: true,
      },
      {
        id: '3',
        senderId: '4',
        text: 'Thanks! I\'ll clean it after using.',
        timestamp: new Date('2024-02-22T09:22:00'),
        read: true,
      },
    ],
    lastRead: new Date('2024-02-22T09:25:00'),
  },
};

// Function to generate a UUID
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Main component
export default function ChatPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeConversation, setActiveConversation] = useState<string>('household');
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDatabaseReady, setIsDatabaseReady] = useState(false);
  const [householdId, setHouseholdId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  
// Check authentication
useEffect(() => {
  const checkAuth = async () => {
    try {
      console.log('Checking authentication status...');
      const { data: { session } } = await supabaseClient.auth.getSession();
      
      if (!session) {
        console.log('No session found, redirecting to login');
        router.push('/login');
        return;
      }
      
      console.log('User authenticated:', session.user.id);
      setUser(session.user);

      // Step 1: Check if the user exists in the User table by ID
      console.log('Checking if user exists in User table by ID');
      const { data: userDataById, error: userIdError } = await supabaseClient
        .from('profiles')
        .select('id, email')
        .eq('id', session.user.id)
        .single();
      
      // Step 2: If user doesn't exist by ID, check if exists by email
      if (userIdError) {
        console.log('User not found by ID, checking by email...', userIdError);
        
        // Check if user exists with the same email
        const { data: userDataByEmail, error: emailError } = await supabaseClient
          .from('profiles')
          .select('id, email')
          .eq('email', session.user.email)
          .maybeSingle();
        
        if (!emailError && userDataByEmail) {
          // User exists with this email but different ID - update the ID
          console.log('Found user with same email but different ID. Updating ID...');
          
          const { error: updateError } = await supabaseClient
            .from('profiles')
            .update({ id: session.user.id })
            .eq('email', session.user.email);
          
          if (updateError) {
            console.error('Error updating user ID:', updateError);
            // Continue anyway - we'll try to work with what we have
          } else {
            console.log('Successfully updated user ID');
          }
        } else {
          // User doesn't exist at all - create them
          console.log('User not found by email either, creating new user...');
          
          try {
            // Create a user record
            const { data: newUser, error: createUserError } = await supabaseClient
              .from('profiles')
              .insert([
                {
                  id: session.user.id,
                  email: session.user.email,
                  name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
                  password: 'MANAGED_BY_SUPABASE_AUTH',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                }
              ])
              .select('id')
              .single();
            
            if (createUserError) {
              // Handle the case where we couldn't create a user (could be duplicate key, etc)
              console.error('Error creating user record:', createUserError);
              
              // If it's a duplicate key error, try one more time with a modified email
              if (createUserError.code === '23505' && createUserError.details?.includes('User_email_key')) {
                console.log('Attempting to create user with modified email to avoid unique constraint...');
                
                const randomSuffix = Math.floor(Math.random() * 10000);
                const modifiedEmail = `${session.user.email?.split('@')[0]}_${randomSuffix}@${session.user.email?.split('@')[1]}`;
                
                const { data: newUserRetry, error: retryError } = await supabaseClient
                  .from('profiles')
                  .insert([
                    {
                      id: session.user.id,
                      email: modifiedEmail, // Use modified email to avoid unique constraint
                      name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
                      password: 'MANAGED_BY_SUPABASE_AUTH',
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString()
                    }
                  ])
                  .select('id')
                  .single();
                
                if (retryError) {
                  console.error('Final error creating user record:', retryError);
                } else {
                  console.log('Created user record with modified email:', newUserRetry.id);
                }
              }
            } else {
              console.log('Created user record:', newUser.id);
            }
          } catch (err) {
            console.error('Unexpected error creating user:', err);
          }
        }
      } else {
        console.log('User found in database:', userDataById.id);
      }

      // Step 3: Check if database tables are ready
      console.log('Checking database readiness...');
      const dbStatus = await areAllChatTablesReady();
      console.log('Database readiness check result:', dbStatus);
      setIsDatabaseReady(dbStatus.ready);
      
      // Step 4: Get user's household
      console.log('Fetching user household data...');
      const { data: householdUser, error: householdError } = await supabaseClient
        .from('household_members')
        .select('household_id')
        .eq('user_id', session.user.id)
        .order('joined_at', { ascending: false })
        .limit(1)
        .single();
      
      if (!householdError && householdUser) {
        console.log('Found household ID:', householdUser.household_id);
        setHouseholdId(householdUser.household_id);
      } else {
        console.log('User has no households or error fetching household:', householdError?.message);
        console.log('Error details:', householdError);
        
        // Step 5: Create a new household if the user doesn't have one
        try {
          console.log('Creating test household for user:', session.user.id);
          
          // Generate a UUID for the new household
          const householdUUID = generateUUID();
          console.log('Generated UUID for new household:', householdUUID);
          
          // 1. Create a new household with explicit UUID
          const { data: newHousehold, error: createError } = await supabaseClient
            .from('households')
            .insert([
              {
                id: householdUUID,
                name: 'Test Household',
                address: 'Test Address',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              }
            ])
            .select('id')
            .single();
          
          if (createError || !newHousehold) {
            console.error('Error creating test household:', createError);
          } else {
            console.log('Created new household:', newHousehold.id);
            
            // 2. Associate the user with the new household
            const householdUserUUID = generateUUID(); // Generate a UUID for the HouseholdUser
            const { data: newMembership, error: memberError } = await supabaseClient
              .from('household_members')
              .insert([
                {
                  id: householdUserUUID,
                  userId: session.user.id,
                  householdId: newHousehold.id,
                  role: 'ADMIN',
                  joined_at: new Date().toISOString()
                }
              ])
              .select()
              .single();
            
            if (memberError) {
              console.error('Error creating household membership:', memberError);
            } else {
              console.log('Created household membership:', newMembership.id);
              setHouseholdId(newHousehold.id);
            }
          }
        } catch (err) {
          console.error('Error in household creation process:', err);
        }
      }
      
      console.log('Initialization complete: isDatabaseReady =', dbStatus.ready, 'householdId =', householdId || '(pending)');
      setLoading(false);
    } catch (error) {
      console.error('Authentication error:', error);
      router.push('/login');
    }
  };

  checkAuth();
}, [router]);

// In the useEffect where you load messages
useEffect(() => {
  if (!user) return;
  
  const loadMessages = async () => {
    console.log('Loading messages with:', {
      isDatabaseReady,
      activeConversation,
      householdId,
      useRealDb: isDatabaseReady && activeConversation === 'household' && householdId
    });
    
    if (isDatabaseReady && activeConversation === 'household' && householdId) {
      console.log('Loading messages for household:', householdId);
      // Use real database data
      try {
        const messageData = await getHouseholdMessages(householdId);
        console.log('Messages loaded from database:', messageData.length);
        setMessages(messageData);
        
        // Mark messages as read
        messageData.forEach((msg: { senderId: any; id: any; }) => {
          if (msg.senderId !== user.id) {
            markMessageAsRead(msg.id, user.id);
          }
        });
      } catch (error) {
        console.error('Error loading messages:', error);
        // Fallback to mock data if there's an error
        console.log('Falling back to mock data due to error');
        if (activeConversation in MOCK_CONVERSATIONS) {
          setMessages(MOCK_CONVERSATIONS[activeConversation].messages);
        } else {
          setMessages([]);
        }
      }
    } else {
      console.log('Using mock data. Database ready:', isDatabaseReady, 'Conversation:', activeConversation, 'HouseholdId:', householdId);
      // Use mock data until database is ready
      if (activeConversation in MOCK_CONVERSATIONS) {
        setMessages(MOCK_CONVERSATIONS[activeConversation].messages);
      } else {
        setMessages([]);
      }
    }
  };
  
  loadMessages();
  
  // Subscribe to new messages if database is ready
  if (isDatabaseReady && activeConversation === 'household' && householdId) {
    console.log('Subscribing to messages for household:', householdId);
    const unsubscribe = subscribeToMessages(householdId, (newMessage: Message) => {
      console.log('New message received:', newMessage);
      setMessages(prevMessages => {
        // Check if message already exists (to prevent duplicates)
        const exists = prevMessages.some(msg => msg.id === newMessage.id);
        if (exists) return prevMessages;
        
        // Mark the message as read if it's not from the current user
        if (newMessage.senderId !== user.id) {
          markMessageAsRead(newMessage.id, user.id);
        }
        
        return [...prevMessages, newMessage];
      });
    });
    
    return unsubscribe;
  }
}, [activeConversation, user, isDatabaseReady, householdId]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSendMessage = async (content: string) => {
    console.log("Attempting to send message:", { 
      content, 
      userId: user?.id, 
      isDatabaseReady, 
      activeConversation, 
      householdId 
    });
    
    if (!content.trim() || !user) return;
    
    setIsSending(true);
    
    try {
      // Always ensure activeConversation is set to 'household' for database messages
      // This fixes the issue where activeConversation might be set to '3' in the logs
      if (isDatabaseReady && householdId) {
        console.log('Sending real message to database for household:', householdId);
        // Use real database
        const result = await sendMessage(householdId, user.id, content);
        console.log('Message send result:', result);
      } else {
        console.log('Using mock data approach for message. Reason:', 
          !isDatabaseReady ? 'Database not ready' : 
          !householdId ? 'No household ID' : 
          `Conversation is ${activeConversation}, not 'household'`
        );
        // Use mock data approach
        const message = {
          id: `new-${Date.now()}`,
          senderId: user.id || '1',
          text: content,
          timestamp: new Date(),
          read: false,
        };
        
        setMessages(prev => [...prev, message]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setNewMessage('');
      setIsSending(false);
    }
  };
  
  // Format timestamp for messages
  const formatTimestamp = (timestamp: Date | string) => {
    const now = new Date();
    const messageDate = new Date(timestamp);
    
    // If the message is from today, show the time
    if (messageDate.toDateString() === now.toDateString()) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // If the message is from this week, show the day and time
    const diffDays = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
      return `${messageDate.toLocaleDateString([], { weekday: 'short' })} ${messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Otherwise, show the full date
    return messageDate.toLocaleDateString();
  };
  
  // Helper function to handle conversation selection and always use household for real database
  const handleConversationSelect = (conversationId: string) => {
    setActiveConversation(conversationId);
    setIsMobileMenuOpen(false);
    
    // Log current state for debugging
    console.log('Selected conversation:', conversationId, 
      'isDatabaseReady:', isDatabaseReady, 
      'householdId:', householdId
    );
  };
  
  // If still checking auth status, show loading
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  // Display current state in UI for debugging
  const debugInfo = {
    isDatabaseReady,
    householdId,
    activeConversation,
    userId: user?.id,
  };

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] md:h-[calc(100vh-theme(spacing.8))] overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Debug info (only visible during development) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed top-0 right-0 bg-black bg-opacity-70 text-white p-2 text-xs z-50">
          <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
        </div>
      )}
      
      {/* Mobile sidebar button */}
      <div className="md:hidden fixed top-16 left-4 z-30">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="mt-4 bg-white dark:bg-gray-800 p-2 rounded-md shadow-md"
        >
          <svg 
            className="h-6 w-6 text-gray-500 dark:text-gray-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M4 6h16M4 12h16m-7 6h7" 
            />
          </svg>
        </button>
      </div>
      
      {/* Chat list sidebar */}
      <div className={`
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 transform transition-transform duration-300 ease-in-out
        fixed md:static top-0 bottom-0 left-0 z-20 w-64 bg-white dark:bg-gray-800 shadow-md md:h-full
        flex flex-col pt-16 md:pt-0
      `}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-bold text-lg text-gray-800 dark:text-white">Messages</h2>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            <button
              onClick={() => handleConversationSelect('household')}
              className={`
                w-full flex items-center p-3 rounded-lg mb-1 
                ${activeConversation === 'household' 
                  ? 'bg-blue-50 dark:bg-blue-900/30' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'}
              `}
            >
              <div className="relative flex-shrink-0 mr-3">
                <div className="h-10 w-10 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center">
                  <svg 
                    className="h-6 w-6 text-blue-600 dark:text-blue-400" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24" 
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" 
                    />
                  </svg>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  Household Chat
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  Everyone
                </p>
              </div>
            </button>
            
            {/* For MVP, we'll just focus on the household chat */}
            {/* Later we can implement private messages between users */}
            {isDatabaseReady ? (
              <div className="mt-4 px-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Private messages will be available in a future update.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-4 mb-2 px-3">
                  <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Private Messages
                  </h3>
                </div>
                
                {MOCK_MEMBERS.filter(m => m.id !== (user?.id || '1')).map(member => (
                  <button
                    key={member.id}
                    onClick={() => handleConversationSelect(member.id)}
                    className={`
                      w-full flex items-center p-3 rounded-lg mb-1 
                      ${activeConversation === member.id 
                        ? 'bg-blue-50 dark:bg-blue-900/30' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700'}
                    `}
                  >
                    <div className="relative flex-shrink-0 mr-3">
                      <Image
                        className="h-10 w-10 rounded-full"
                        src={member.avatar}
                        alt={member.name}
                        width={40}
                        height={40}
                      />
                      <div 
                        className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-gray-800 ${
                          member.status === 'ONLINE' ? 'bg-green-500' :
                          member.status === 'AWAY' ? 'bg-yellow-500' : 'bg-gray-500'
                        }`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {member.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {member.status === 'ONLINE' ? 'Online' : member.status === 'AWAY' ? 'Away' : 'Offline'}
                      </p>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
      
      {/* Main chat area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 md:ml-0 ml-0 relative h-full md:border-l border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700 p-4 flex items-center">
          {activeConversation === 'household' ? (
            <>
              <div className="h-10 w-10 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center mr-3">
                <svg 
                  className="h-6 w-6 text-blue-600 dark:text-blue-400" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" 
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-medium text-gray-800 dark:text-white">Household Chat</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {isDatabaseReady ? 'Connected to database' : 'Using mock data'}
                </p>
              </div>
            </>
          ) : (
            <>
              {MOCK_MEMBERS.filter(m => m.id === activeConversation).map(member => (
                <div key={member.id} className="flex items-center">
                  <div className="relative mr-3">
                    <Image
                      className="h-10 w-10 rounded-full"
                      src={member.avatar}
                      alt={member.name}
                      width={40}
                      height={40}
                    />
                    <div 
                      className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-gray-800 ${
                        member.status === 'ONLINE' ? 'bg-green-500' :
                        member.status === 'AWAY' ? 'bg-yellow-500' : 'bg-gray-500'
                      }`}
                    />
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-gray-800 dark:text-white">{member.name}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {member.status === 'ONLINE' ? 'Online' : member.status === 'AWAY' ? 'Away' : 'Offline'}
                    </p>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length > 0 ? (
            messages.map((message, index) => {
              const isCurrentUser = message.senderId === user.id;
              let sender;
              
              if (isDatabaseReady) {
                sender = message.sender || { 
                  name: isCurrentUser ? 'You' : 'Unknown', 
                  avatar: null 
                };
              } else {
                sender = MOCK_MEMBERS.find(m => m.id === message.senderId) || 
                  { name: 'Unknown', avatar: 'https://i.pravatar.cc/150' };
              }
              
              const showSender = 
                activeConversation === 'household' && 
                (index === 0 || messages[index - 1].senderId !== message.senderId);
              
              return (
                <div 
                  key={message.id} 
                  className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-3/4 ${isCurrentUser ? 'order-1' : 'order-2'}`}>
                    {showSender && !isCurrentUser && activeConversation === 'household' && (
                      <div className="flex items-center mb-1">
                        {sender.avatar ? (
                          <Image
                            className="h-6 w-6 rounded-full mr-2"
                            src={sender.avatar}
                            alt={sender.name}
                            width={24}
                            height={24}
                          />
                        ) : (
                          <div className="h-6 w-6 rounded-full bg-gray-300 dark:bg-gray-600 mr-2 flex items-center justify-center text-xs">
                            {sender.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {sender.name}
                        </span>
                      </div>
                    )}
                    
                    <div
                      className={`rounded-lg px-4 py-2 break-words ${
                        isCurrentUser 
                          ? 'bg-blue-500 text-white rounded-tr-none' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-none'
                      }`}
                    >
                      <p>{message.content || message.text}</p>
                    </div>
                    
                    <div 
                      className={`text-xs text-gray-500 dark:text-gray-400 mt-1 ${
                        isCurrentUser ? 'text-right' : 'text-left'
                      }`}
                    >
                      {formatTimestamp(message.createdAt || message.timestamp)}
                    </div>
                  </div>
                  
                  {showSender && isCurrentUser && activeConversation === 'household' && (
                    <div className="order-2 ml-2">
                      {sender.avatar ? (
                        <Image
                          className="h-6 w-6 rounded-full"
                          src={sender.avatar}
                          alt={sender.name}
                          width={24}
                          height={24}
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs">
                          {sender.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500 dark:text-gray-400">No messages yet. Start the conversation!</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <form onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(newMessage);
            setNewMessage('');
          }} className="flex items-center">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              disabled={isSending || (!householdId && isDatabaseReady)}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending || (!householdId && isDatabaseReady)}
              className="bg-blue-500 text-white px-4 py-2 rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <svg 
                  className="animate-spin h-5 w-5 text-white" 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24"
                >
                  <circle 
                    className="opacity-25" 
                    cx="12" 
                    cy="12" 
                    r="10" 
                    stroke="currentColor"
                    strokeWidth="4"
               ></circle>
               <path 
                 className="opacity-75" 
                 fill="currentColor" 
                 d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
               ></path>
             </svg>
           ) : (
             <svg 
               className="h-5 w-5"
               fill="none" 
               stroke="currentColor" 
               viewBox="0 0 24 24" 
               xmlns="http://www.w3.org/2000/svg"
             >
               <path 
                 strokeLinecap="round" 
                 strokeLinejoin="round" 
                 strokeWidth={2} 
                 d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" 
               />
             </svg>
           )}
         </button>
       </form>
     </div>
   </div>
 </div>
);
}