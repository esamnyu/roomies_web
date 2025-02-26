// src/app/(dashboard)/chat/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';

// Mock data for demonstration
const MOCK_MEMBERS = [
  {
    id: '1',
    name: 'Jane Smith',
    avatar: 'https://i.pravatar.cc/150?img=1',
    status: 'ONLINE' as const,
  },
  {
    id: '2',
    name: 'John Doe',
    avatar: 'https://i.pravatar.cc/150?img=8',
    status: 'AWAY' as const,
  },
  {
    id: '3',
    name: 'Emily Johnson',
    avatar: 'https://i.pravatar.cc/150?img=5',
    status: 'ONLINE' as const,
  },
  {
    id: '4',
    name: 'Michael Brown',
    avatar: 'https://i.pravatar.cc/150?img=12',
    status: 'OFFLINE' as const,
  },
];

// Mock message data
const MOCK_CONVERSATIONS: Record<string, {
  messages: Array<{
    id: string;
    senderId: string;
    text: string;
    timestamp: Date;
    read: boolean;
  }>;
  lastRead: Date | null;
}> = {
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
        text: 'I think Emily was using it last. Check the storage closet.',
        timestamp: new Date('2024-02-24T10:20:00'),
        read: true,
      },
      {
        id: '3',
        senderId: '2',
        text: 'Found it, thanks!',
        timestamp: new Date('2024-02-24T10:45:00'),
        read: true,
      },
    ],
    lastRead: new Date('2024-02-24T10:45:00'),
  },
  '3': {
    messages: [
      {
        id: '1',
        senderId: '1',
        text: 'Emily, we need to talk about the bathroom cleaning schedule.',
        timestamp: new Date('2024-02-23T18:30:00'),
        read: true,
      },
      {
        id: '2',
        senderId: '3',
        text: 'Sure, what is up?',
        timestamp: new Date('2024-02-23T18:45:00'),
        read: true,
      },
      {
        id: '3',
        senderId: '1',
        text: 'I think we should switch weeks. I have a big deadline coming up.',
        timestamp: new Date('2024-02-23T18:50:00'),
        read: true,
      },
      {
        id: '4',
        senderId: '3',
        text: 'No problem! I can take this week and you can do next week.',
        timestamp: new Date('2024-02-23T18:55:00'),
        read: true,
      },
      {
        id: '5',
        senderId: '1',
        text: 'Thanks! You are the best!',
        timestamp: new Date('2024-02-23T19:00:00'),
        read: true,
      },
    ],
    lastRead: new Date('2024-02-23T19:00:00'),
  },
  '4': {
    messages: [
      {
        id: '1',
        senderId: '4',
        text: 'Jane, did you see my blue shirt?',
        timestamp: new Date('2024-02-26T09:15:00'),
        read: false,
      },
    ],
    lastRead: null,
  },
};

type MessageType = {
  id: string;
  senderId: string;
  text: string;
  timestamp: Date;
  read: boolean;
};

export default function ChatPage() {
  const { data: session } = useSession();
  const [activeConversation, setActiveConversation] = useState<string>('household');
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Current user ID (for demo)
  const currentUserId = '1';
  
  // Set messages when active conversation changes
  useEffect(() => {
    if (activeConversation in MOCK_CONVERSATIONS) {
      setMessages(MOCK_CONVERSATIONS[activeConversation].messages);
    } else {
      setMessages([]);
    }
  }, [activeConversation]);
  
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim()) return;
    
    // Create a new message
    const message: MessageType = {
      id: `new-${Date.now()}`,
      senderId: currentUserId,
      text: newMessage,
      timestamp: new Date(),
      read: false,
    };
    
    // Update the conversation
    const updatedConversation = {
      ...MOCK_CONVERSATIONS[activeConversation],
      messages: [...MOCK_CONVERSATIONS[activeConversation].messages, message],
    };
    
    MOCK_CONVERSATIONS[activeConversation] = updatedConversation;
    
    // Update the messages state
    setMessages([...messages, message]);
    
    // Clear the input
    setNewMessage('');
  };
  
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
  
  const getUnreadCount = (conversationId: string) => {
    if (!(conversationId in MOCK_CONVERSATIONS)) return 0;
    
    const { messages, lastRead } = MOCK_CONVERSATIONS[conversationId];
    
    // For private conversations, only count messages sent by the other person
    const targetMessages = conversationId === 'household' 
      ? messages 
      : messages.filter(m => m.senderId !== currentUserId);
    
    if (!lastRead) {
      return targetMessages.length;
    }
    
    return targetMessages.filter(m => new Date(m.timestamp) > new Date(lastRead) && !m.read).length;
  };
  
  const getStatusColor = (status: 'ONLINE' | 'AWAY' | 'OFFLINE') => {
    switch (status) {
      case 'ONLINE':
        return 'bg-green-500';
      case 'AWAY':
        return 'bg-yellow-500';
      case 'OFFLINE':
        return 'bg-gray-500';
    }
  };
  
  const getConversationName = (conversationId: string) => {
    if (conversationId === 'household') {
      return 'Household Chat';
    }
    
    const member = MOCK_MEMBERS.find(m => m.id === conversationId);
    return member ? member.name : 'Unknown';
  };
  
  const getMessageSender = (senderId: string) => {
    return MOCK_MEMBERS.find(m => m.id === senderId) || { name: 'Unknown', avatar: 'https://i.pravatar.cc/150' };
  };

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
                {getUnreadCount('household') > 0 && (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {getUnreadCount('household')}
                  </div>
                )}
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
            
            {MOCK_MEMBERS.filter(m => m.id !== currentUserId).map(member => (
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
                    className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-gray-800 ${getStatusColor(member.status)}`}
                  />
                  {getUnreadCount(member.id) > 0 && (
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {getUnreadCount(member.id)}
                    </div>
                  )}
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
                      className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white dark:border-gray-800 ${getStatusColor(member.status)}`}
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
            const isCurrentUser = message.senderId === currentUserId;
            const sender = getMessageSender(message.senderId);
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
          <form onSubmit={handleSendMessage} className="flex items-center">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            />
            <button
              type="submit"
              className="bg-blue-500 text-white px-4 py-2 rounded-r-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
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
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}