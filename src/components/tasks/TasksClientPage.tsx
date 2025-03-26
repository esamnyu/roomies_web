'use client';

import { useState } from 'react';
import TaskForm from '@/components/tasks/TaskForm';
import TaskList from '@/components/tasks/TaskList';
import type { Task } from '@/components/tasks/TaskList';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client (browser-side)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  }
);

interface TasksClientPageProps {
  initialTasks: Task[];
  members: {
    id: string;
    name: string;
    avatar?: string;
  }[];
  householdId: string;
  currentUserId: string;
}

export default function TasksClientPage({
  initialTasks,
  members,
  householdId,
  currentUserId
}: TasksClientPageProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'MY_TASKS' | 'MY_CREATED' | 'PENDING' | 'COMPLETED'>('ALL');
  
  // Fetch tasks from API
  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      
      // Call the tasks API
      const response = await fetch(`/api/tasks?householdId=${householdId}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch tasks');
      }
      
      const taskData = await response.json();
      setTasks(taskData);
      setError(null);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while fetching tasks');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Filtered tasks based on selected filter
  const filteredTasks = tasks.filter(task => {
    switch (filter) {
      case 'MY_TASKS':
        return task.assigneeId === currentUserId;
      case 'MY_CREATED':
        return task.creatorId === currentUserId;
      case 'PENDING':
        return task.status === 'PENDING' || task.status === 'IN_PROGRESS';
      case 'COMPLETED':
        return task.status === 'COMPLETED';
      default:
        return true;
    }
  });
  
  // Sort tasks: Urgent first, then by due date
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    // First by priority (URGENT > HIGH > MEDIUM > LOW)
    const priorityOrder: Record<string, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    const priorityDiff = priorityOrder[a.priority] - 
                         priorityOrder[b.priority];
    
    if (priorityDiff !== 0) return priorityDiff;
    
    // Then by due date (earlier first)
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    
    const dateA = a.dueDate instanceof Date ? a.dueDate : new Date(a.dueDate);
    const dateB = b.dueDate instanceof Date ? b.dueDate : new Date(b.dueDate);
    
    return dateA.getTime() - dateB.getTime();
  });
  
  // Type for the new task with optional id to match your components
  type NewTask = Omit<Task, 'id'> & { id?: string };
  
  const handleAddTask = async (newTask: NewTask) => {
    try {
      setIsLoading(true);
      // Call the API to create the task
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newTask),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to create task');
      }
      
      // Refresh tasks after adding
      await fetchTasks();
      setShowTaskForm(false);
      setCurrentTask(null);
    } catch (err) {
      console.error('Error adding task:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while creating the task');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleEditTask = (task: Task) => {
    setCurrentTask(task);
    setShowTaskForm(true);
  };
  
  const handleUpdateTask = async (updatedTask: Task | NewTask) => {
    // Make sure updatedTask has an id (it must have one since it's being edited)
    if (!updatedTask.id) {
      console.error("Task ID is missing");
      return;
    }
    
    try {
      setIsLoading(true);
      // Call the API to update the task
      const response = await fetch(`/api/tasks?id=${updatedTask.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedTask),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update task');
      }
      
      // Refresh tasks after updating
      await fetchTasks();
      setShowTaskForm(false);
      setCurrentTask(null);
    } catch (err) {
      console.error('Error updating task:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while updating the task');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleDeleteTask = async (taskId: string) => {
    try {
      setIsLoading(true);
      // Call the API to delete the task
      const response = await fetch(`/api/tasks?id=${taskId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete task');
      }
      
      // Refresh tasks after deleting
      await fetchTasks();
    } catch (err) {
      console.error('Error deleting task:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while deleting the task');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      setIsLoading(true);
      // Find the task to update
      const taskToUpdate = tasks.find(task => task.id === taskId);
      
      if (!taskToUpdate) {
        throw new Error('Task not found');
      }
      
      // Prepare updated task data
      const updatedTask = { 
        ...taskToUpdate, 
        status: newStatus as Task['status'],
        // Add completedAt if status is COMPLETED
        completedAt: newStatus === 'COMPLETED' ? new Date() : undefined
      };
      
      // Call the API to update the task
      const response = await fetch(`/api/tasks?id=${taskId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedTask),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to update task status');
      }
      
      // Refresh tasks after updating status
      await fetchTasks();
    } catch (err) {
      console.error('Error updating task status:', err);
      setError(err instanceof Error ? err.message : 'An error occurred while updating the task status');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Household Tasks</h1>
        <button
          onClick={() => {
            setCurrentTask(null);
            setShowTaskForm(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Create New Task
        </button>
      </div>
      
      {/* Error display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-md">
          {error}
        </div>
      )}
      
      {/* Filter Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="-mb-px flex space-x-6">
            <button
              onClick={() => setFilter('ALL')}
              className={`${
                filter === 'ALL'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-500'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
            >
              All Tasks
            </button>
            <button
              onClick={() => setFilter('MY_TASKS')}
              className={`${
                filter === 'MY_TASKS'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-500'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
            >
              Assigned to Me
            </button>
            <button
              onClick={() => setFilter('MY_CREATED')}
              className={`${
                filter === 'MY_CREATED'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-500'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
            >
              Created by Me
            </button>
            <button
              onClick={() => setFilter('PENDING')}
              className={`${
                filter === 'PENDING'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-500'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
            >
              Pending
            </button>
            <button
              onClick={() => setFilter('COMPLETED')}
              className={`${
                filter === 'COMPLETED'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-500'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm`}
            >
              Completed
            </button>
          </nav>
        </div>
      </div>
      
      {/* Loading state */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        /* Task List */
        <TaskList 
          tasks={sortedTasks}
          currentUserId={currentUserId}
          onStatusChange={handleStatusChange}
          onEditTask={handleEditTask}
          onDeleteTask={handleDeleteTask}
        />
      )}
      
      {/* Task Form Modal */}
      {showTaskForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={() => setShowTaskForm(false)} />
            
            <div className="relative bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full p-6 shadow-xl">
              <div className="absolute top-0 right-0 pt-4 pr-4">
                <button
                  type="button"
                  className="bg-white dark:bg-gray-800 rounded-md text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  onClick={() => setShowTaskForm(false)}
                >
                  <span className="sr-only">Close</span>
                  <svg 
                    className="h-6 w-6" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor" 
                    aria-hidden="true"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth="2" 
                      d="M6 18L18 6M6 6l12 12" 
                    />
                  </svg>
                </button>
              </div>
              
              <div className="mt-3 text-center sm:mt-0 sm:text-left">
                <h3 className="text-lg font-medium leading-6 text-gray-900 dark:text-white">
                  {currentTask ? 'Edit Task' : 'Create New Task'}
                </h3>
              </div>
              
              <TaskForm
                task={currentTask}
                members={members}
                householdId={householdId}
                onSubmit={currentTask ? handleUpdateTask : handleAddTask}
                onCancel={() => {
                  setShowTaskForm(false);
                  setCurrentTask(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}