// src/components/tasks/TaskList.tsx
'use client';

import { useState } from 'react';
import Image from 'next/image';

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  creatorId: string;
  creatorName?: string;
  assigneeId?: string;
  assigneeName?: string;
  dueDate?: Date | string;
  recurring: boolean;
  recurrenceRule?: string;
  householdId: string;
  completedAt?: Date;
}

export interface TaskListProps {
  tasks: Task[];
  currentUserId: string;
  onStatusChange: (taskId: string, newStatus: string) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (taskId: string) => void;
}

export default function TaskList({ 
  tasks, 
  currentUserId, 
  onStatusChange, 
  onEditTask, 
  onDeleteTask 
}: TaskListProps) {
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const toggleTaskExpand = (taskId: string) => {
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
    } else {
      setExpandedTaskId(taskId);
    }
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'LOW':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      case 'MEDIUM':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'HIGH':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'URGENT':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    }
  };

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'SKIPPED':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const formatDueDate = (date?: Date | string) => {
    if (!date) return 'No due date';
    const dueDate = typeof date === 'string' ? new Date(date) : date;
    return dueDate.toLocaleDateString();
  };

  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
      {tasks.length === 0 ? (
        <div className="p-6 text-center text-gray-500 dark:text-gray-400">
          No tasks found with the current filter.
        </div>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {tasks.map(task => (
            <li key={task.id} className="px-4 py-4">
              <div 
                className="flex items-center justify-between cursor-pointer"
                onClick={() => toggleTaskExpand(task.id)}
              >
                <div className="flex items-start">
                  {/* Task Status Checkbox */}
                  <div className="mr-4 mt-1">
                    <input
                      type="checkbox"
                      checked={task.status === 'COMPLETED'}
                      onChange={(e) => {
                        e.stopPropagation();
                        onStatusChange(task.id, e.target.checked ? 'COMPLETED' : 'PENDING');
                      }}
                      className="h-5 w-5 text-blue-600 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800"
                    />
                  </div>
                  
                  {/* Task Overview */}
                  <div>
                    <h3 className={`text-lg font-medium ${
                      task.status === 'COMPLETED' ? 'text-gray-500 dark:text-gray-400 line-through' : 'text-gray-900 dark:text-white'
                    }`}>
                      {task.title}
                    </h3>
                    
                    <div className="mt-1 flex flex-wrap gap-2">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                        {task.status.replace('_', ' ')}
                      </span>
                      
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(task.priority)}`}>
                        {task.priority}
                      </span>
                      
                      {task.recurring && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300">
                          Recurring
                        </span>
                      )}
                      
                      <span className="inline-flex items-center text-xs text-gray-500 dark:text-gray-400">
                        Due: {formatDueDate(task.dueDate)}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <span className="text-sm text-gray-500 dark:text-gray-400 mr-2">
                    {task.assigneeName || 'Unassigned'}
                  </span>
                  <svg 
                    className={`h-5 w-5 text-gray-400 transform transition-transform ${expandedTaskId === task.id ? 'rotate-180' : ''}`} 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              
              {/* Expanded Task Details */}
              {expandedTaskId === task.id && (
                <div className="mt-4 pl-9 border-t border-gray-100 dark:border-gray-700 pt-4">
                  {task.description && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{task.description}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assigned by</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{task.creatorName}</p>
                    </div>
                    
                    {task.recurring && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recurrence</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {task.recurrenceRule === 'DAILY' && 'Daily'}
                          {task.recurrenceRule === 'WEEKLY' && 'Weekly'}
                          {task.recurrenceRule === 'BIWEEKLY' && 'Every 2 weeks'}
                          {task.recurrenceRule === 'MONTHLY' && 'Monthly'}
                        </p>
                      </div>
                    )}
                    
                    {task.completedAt && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Completed on</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {new Date(task.completedAt).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditTask(task);
                      }}
                      className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteTask(task.id);
                      }}
                      className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}