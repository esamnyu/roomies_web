// src/components/chat/MessageBubble.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';

interface MessageBubbleProps {
  id: string;
  text: string;
  timestamp: Date;
  isCurrentUser: boolean;
  senderName?: string;
  senderAvatar?: string;
  isGroupChat?: boolean;
  isRead?: boolean;
}

export default function MessageBubble({
  id,
  text,
  timestamp,
  isCurrentUser,
  senderName,
  senderAvatar,
  isGroupChat = false,
  isRead = false
}: MessageBubbleProps) {
  const [showTimestamp, setShowTimestamp] = useState(false);

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    
    // If message is from today, show only time
    if (messageDate.toDateString() === now.toDateString()) {
      return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // If message is from this week, show day and time
    const diffDays = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
      return `${messageDate.toLocaleDateString([], { weekday: 'short' })} ${messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    // Otherwise, show full date
    return messageDate.toLocaleDateString();
  };

  return (
    <div 
      className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-4`}
      onClick={() => setShowTimestamp(!showTimestamp)}
    >
      <div className={`flex max-w-[75%] ${isCurrentUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar - only show if not current user and in group chat */}
        {!isCurrentUser && isGroupChat && (
          <div className="flex-shrink-0 mr-2">
            {senderAvatar ? (
              <Image
                src={senderAvatar}
                alt={senderName || 'User'}
                width={32}
                height={32}
                className="rounded-full h-8 w-8"
              />
            ) : (
              <div className="bg-gray-300 dark:bg-gray-600 rounded-full h-8 w-8 flex items-center justify-center text-sm font-medium text-gray-600 dark:text-gray-200">
                {senderName ? senderName.charAt(0).toUpperCase() : '?'}
              </div>
            )}
          </div>
        )}
        
        <div className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}>
          {/* Sender name - only show in group chat and not current user */}
          {!isCurrentUser && isGroupChat && senderName && (
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 ml-1">
              {senderName}
            </span>
          )}
          
          {/* Message bubble */}
          <div 
            className={`px-4 py-2 rounded-lg break-words ${
              isCurrentUser 
                ? 'bg-blue-500 text-white rounded-tr-none' 
                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-none'
            }`}
          >
            <p className="whitespace-pre-wrap">{text}</p>
          </div>
          
          {/* Timestamp and read status */}
          <div 
            className={`flex items-center mt-1 text-xs text-gray-500 dark:text-gray-400 ${
              isCurrentUser ? 'justify-end' : 'justify-start'
            }`}
          >
            {(showTimestamp || isCurrentUser) && (
              <span className="mx-1">{formatTimestamp(timestamp)}</span>
            )}
            
            {isCurrentUser && (
              <span className="ml-1">
                {isRead ? (
                  <svg 
                    className="h-3 w-3 text-blue-500" 
                    fill="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path d="M18 7l-8 8-4-4 1.5-1.5L10 12l6.5-6.5L18 7z" />
                  </svg>
                ) : (
                  <svg 
                    className="h-3 w-3 text-gray-400" 
                    fill="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path d="M18 7l-8 8-4-4 1.5-1.5L10 12l6.5-6.5L18 7z" />
                  </svg>
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}