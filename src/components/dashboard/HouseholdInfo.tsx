// src/components/dashboard/HouseholdInfo.tsx
'use client';

import { useState } from 'react';

interface HouseholdInfoProps {
  name: string;
  address: string;
  moveInDate: string;
  memberCount: number;
  pendingExpenses?: number;
  upcomingTasks?: number;
  unreadMessages?: number;
}

export default function HouseholdInfo({
  name,
  address,
  moveInDate,
  memberCount,
  pendingExpenses = 0,
  upcomingTasks = 0,
  unreadMessages = 0,
}: HouseholdInfoProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [householdName, setHouseholdName] = useState(name);
  const [householdAddress, setHouseholdAddress] = useState(address);

  const handleSave = () => {
    // In a real app, you would save this data to your backend
    // For now, we'll just update the local state
    setIsEditing(false);
    // You would add an API call here to update the household info
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        {isEditing ? (
          <input
            type="text"
            value={householdName}
            onChange={(e) => setHouseholdName(e.target.value)}
            className="text-2xl font-bold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 w-full"
          />
        ) : (
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{householdName}</h2>
        )}
        
        <button
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {isEditing ? 'Save' : 'Edit'}
        </button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Address</p>
          {isEditing ? (
            <input
              type="text"
              value={householdAddress}
              onChange={(e) => setHouseholdAddress(e.target.value)}
              className="text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 w-full"
            />
          ) : (
            <p className="text-gray-700 dark:text-gray-300">{householdAddress}</p>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Move-in Date</p>
          <p className="text-gray-700 dark:text-gray-300">{moveInDate}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Members</p>
          <p className="text-gray-700 dark:text-gray-300">{memberCount} people</p>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-md">
          <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Pending Expenses</p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{pendingExpenses}</p>
        </div>
        <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-md">
          <p className="text-sm font-medium text-green-700 dark:text-green-300">Upcoming Tasks</p>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300">{upcomingTasks}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-md">
          <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Unread Messages</p>
          <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{unreadMessages}</p>
        </div>
      </div>
    </div>
  );
}