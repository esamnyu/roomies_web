// src/app/(dashboard)/chat/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabaseClient } from '@/lib/supabase';
import { getHouseholdMessages, sendMessage, subscribeToMessages, Message } from '@/lib/chat';
import ChatInput from '@/components/chat/ChatInput';
import MessageBubble from '@/components/chat/MessageBubble';

// Keep your existing mock data for fallback
const MOCK_MEMBERS = [
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

const MOCK_CONVERSATIONS = {
  'household': {
    messages: [
      {
        id: '1',
        senderId: '3',
        text: 'Hey everyone, just a reminder that rent is due tomorrow!',
        timestamp: new Date('2024-02-25T14:30:00'),
        read: true,
      },
      // Add more of your mock messages here
    ],
    lastRead: new Date('2024-02-25T15:10:00'),
  },
  // Add your other mock conversations here
};

export default function ChatPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeConversation, setActiveConversation] = useState<string>('household');
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  
  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (!session) {
          router.push('/login');
          return;
        }
        
        setUser(session.user);
        setLoading(false);
      } catch (error) {
        console.error('Authentication error:', error);
        router.push('/login');
      }
    };

    checkAuth();
  }, [router]);

  // Load messages
  useEffect(() => {
    if (!user) return;
    
    // For now, use mock data until database is properly set up
    if (activeConversation in MOCK_CONVERSATIONS) {
      setMessages(MOCK_CONVERSATIONS[activeConversation].messages);
    } else {
      setMessages([]);
    }
    
    // Uncomment this when your database is ready:
    /*
    const loadMessages = async () => {
      if (activeConversation === 'household') {
        // In a real app, get the householdId from user's context
        const householdId = '1'; // Replace with actual household ID
        const messageData = await getHouseholdMessages(householdId);
        setMessages(messageData);
      }
    };
    
    loadMessages();
    
    // Subscribe to new messages
    if (activeConversation === 'household') {
      const householdId = '1'; // Replace with actual household ID
      const unsubscribe = subscribeToMessages(householdId, (newMessage) => {
        setMessages(prevMessages => [...prevMessages, newMessage]);
      });
      
      return unsubscribe;
    }
    */
  }, [activeConversation, user]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSendMessage = async (content: string) => {
    if (!content.trim() || !user) return;
    
    setIsSending(true);
    
    try {
      // For now, use mock data approach
      const message = {
        id: `new-${Date.now()}`,
        senderId: user.id || '1',
        text: content,
        timestamp: new Date(),
        read: false,
      };
      
      setMessages(prev => [...prev, message]);
      
      // Uncomment when your database is ready:
      /*
      if (activeConversation === 'household') {
        // In a real app, get the householdId from user's context
        const householdId = '1'; // Replace with actual household ID
        await sendMessage(householdId, user.id, content);
      }
      */
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setNewMessage('');
      setIsSending(false);
    }
  };
  
  // Format timestamp for messages
  const formatTimestamp = (timestamp: Date) => {
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
  
  // If still checking auth status, show loading
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-theme(spacing.16))] md:h-[calc(100vh-theme(spacing.8))] overflow-hidden bg-gray-50 dark:bg-gray-900">
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
              onClick={() => {
                setActiveConversation('household');
                setIsMobileMenuOpen(false);
              }}
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
            
            <div className="mt-4 mb-2 px-3">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Private Messages
              </h3>
            </div>
            
            {MOCK_MEMBERS.filter(m => m.id !== (user?.id || '1')).map(member => (
              <button
                key={member.id}
                onClick={() => {
                  setActiveConversation(member.id);
                  setIsMobileMenuOpen(false);
                }}
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
                  {MOCK_MEMBERS.length} members
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
          {messages.map((message, index) => {
            const isCurrentUser = message.senderId === (user?.id || '1');
            const sender = MOCK_MEMBERS.find(m => m.id === message.senderId) || { name: 'Unknown', avatar: 'https://i.pravatar.cc/150' };
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
                      <Image
                        className="h-6 w-6 rounded-full mr-2"
                        src={sender.avatar}
                        alt={sender.name}
                        width={24}
                        height={24}
                      />
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
                    <p>{message.text}</p>
                  </div>
                  
                  <div 
                    className={`text-xs text-gray-500 dark:text-gray-400 mt-1 ${
                      isCurrentUser ? 'text-right' : 'text-left'
                    }`}
                  >
                    {formatTimestamp(message.timestamp)}
                  </div>
                </div>
                
                {showSender && isCurrentUser && activeConversation === 'household' && (
                  <div className="order-2 ml-2">
                    <Image
                      className="h-6 w-6 rounded-full"
                      src={sender.avatar}
                      alt={sender.name}
                      width={24}
                      height={24}
                    />
                  </div>
                )}
              </div>
            );
          })}
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
              disabled={isSending}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending}
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