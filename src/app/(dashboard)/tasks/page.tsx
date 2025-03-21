// src/app/(dashboard)/tasks/page.tsx
'use client';

import { useState, useEffect } from 'react';
import TaskForm from '@/components/tasks/TaskForm';
import TaskList from '@/components/tasks/TaskList'; // Fixed casing to match your actual file
import type { Task } from '@/components/tasks/TaskList'; // Import the Task type from your actual file

// Mock data for development
const MOCK_TASKS: Task[] = [
  {
    id: '1',
    title: 'Take out the trash',
    description: 'Empty all trash cans and take to the curb for Tuesday pickup',
    status: 'PENDING' as const,
    priority: 'MEDIUM' as const,
    creatorId: '1',
    creatorName: 'Jane Smith',
    assigneeId: '2',
    assigneeName: 'John Doe',
    dueDate: new Date('2024-02-28T00:00:00.000Z'),
    recurring: true,
    recurrenceRule: 'WEEKLY',
    householdId: '1'
  },
  {
    id: '2',
    title: 'Clean the bathroom',
    description: 'Deep clean the shared bathroom including shower, toilet, and sink',
    status: 'IN_PROGRESS' as const,
    priority: 'HIGH' as const,
    creatorId: '3',
    creatorName: 'Emily Johnson',
    assigneeId: '1',
    assigneeName: 'Jane Smith',
    dueDate: new Date('2024-02-26T00:00:00.000Z'),
    recurring: false,
    householdId: '1'
  },
  {
    id: '3',
    title: 'Buy cleaning supplies',
    description: 'We need more dish soap, sponges, and all-purpose cleaner',
    status: 'COMPLETED' as const,
    priority: 'LOW' as const,
    creatorId: '2',
    creatorName: 'John Doe',
    assigneeId: '4',
    assigneeName: 'Michael Brown',
    dueDate: new Date('2024-02-20T00:00:00.000Z'),
    recurring: false,
    householdId: '1',
    completedAt: new Date('2024-02-19T00:00:00.000Z')
  },
  {
    id: '4',
    title: 'Vacuum living room',
    description: 'Also dust the shelves and clean the coffee table',
    status: 'PENDING' as const,
    priority: 'MEDIUM' as const,
    creatorId: '1',
    creatorName: 'Jane Smith',
    assigneeId: '3',
    assigneeName: 'Emily Johnson',
    dueDate: new Date('2024-02-29T00:00:00.000Z'),
    recurring: true,
    recurrenceRule: 'WEEKLY',
    householdId: '1'
  },
  {
    id: '5',
    title: 'Pay internet bill',
    description: 'Due on the 1st of every month',
    status: 'PENDING' as const,
    priority: 'URGENT' as const,
    creatorId: '4',
    creatorName: 'Michael Brown',
    assigneeId: '1',
    assigneeName: 'Jane Smith',
    dueDate: new Date('2024-03-01T00:00:00.000Z'),
    recurring: true,
    recurrenceRule: 'MONTHLY',
    householdId: '1'
  }
];

const MOCK_MEMBERS = [
  {
    id: '1',
    name: 'Jane Smith',
    avatar: 'https://i.pravatar.cc/150?img=1',
  },
  {
    id: '2',
    name: 'John Doe',
    avatar: 'https://i.pravatar.cc/150?img=8',
  },
  {
    id: '3',
    name: 'Emily Johnson',
    avatar: 'https://i.pravatar.cc/150?img=5',
  },
  {
    id: '4',
    name: 'Michael Brown',
    avatar: 'https://i.pravatar.cc/150?img=12',
  },
];

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [currentTask, setCurrentTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'MY_TASKS' | 'MY_CREATED' | 'PENDING' | 'COMPLETED'>('ALL');
  
  // For demo purposes, assuming current user is user1
  const currentUserId = '1';
  
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
  
  const handleAddTask = (newTask: NewTask) => {
    // Generate a simple ID - in a real app this would come from the backend
    const id = (tasks.length + 1).toString();
    
    // Find the assignee name from members list
    const assigneeName = MOCK_MEMBERS.find(m => m.id === newTask.assigneeId)?.name || '';
    
    // In a real app, you would send this data to your API
    const taskToAdd: Task = {
      ...newTask,
      id, // Ensure id is provided
      creatorId: currentUserId,
      creatorName: MOCK_MEMBERS.find(m => m.id === currentUserId)?.name || '',
      assigneeName,
    };
    
    setTasks([...tasks, taskToAdd]);
    setShowTaskForm(false);
    setCurrentTask(null);
  };
  
  const handleEditTask = (task: Task) => {
    setCurrentTask(task);
    setShowTaskForm(true);
  };
  
// Update your handleUpdateTask function to accept both Task and NewTask
const handleUpdateTask = (updatedTask: Task | NewTask) => {
    // Make sure updatedTask has an id (it must have one since it's being edited)
    if (!updatedTask.id) {
      console.error("Task ID is missing");
      return;
    }
  
    // Continue with your existing code
    const updatedTasks = tasks.map(task => 
      task.id === updatedTask.id ? {
        ...updatedTask,
        id: updatedTask.id, // Explicitly assign id to satisfy TypeScript
        assigneeName: MOCK_MEMBERS.find(m => m.id === updatedTask.assigneeId)?.name || ''
      } : task
    );
    
    setTasks(updatedTasks);
    setShowTaskForm(false);
    setCurrentTask(null);
  };
  
  const handleDeleteTask = (taskId: string) => {
    // In a real app, you would send this request to your API
    const filteredTasks = tasks.filter(task => task.id !== taskId);
    setTasks(filteredTasks);
  };
  
  const handleStatusChange = (taskId: string, newStatus: string) => {
    // In a real app, you would send this request to your API
    const updatedTasks = tasks.map(task => {
      if (task.id === taskId) {
        // Ensure newStatus is properly typed 
        const status = newStatus as Task['status'];
        const updatedTask = { ...task, status };
        if (status === 'COMPLETED') {
          updatedTask.completedAt = new Date();
        } else {
          updatedTask.completedAt = undefined;
        }
        return updatedTask;
      }
      return task;
    });
    
    setTasks(updatedTasks);
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
      
      {/* Task List */}
      <TaskList 
        tasks={sortedTasks}
        currentUserId={currentUserId}
        onStatusChange={handleStatusChange}
        onEditTask={handleEditTask}
        onDeleteTask={handleDeleteTask}
      />
      
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
                members={MOCK_MEMBERS}
                onSubmit={currentTask ? handleUpdateTask : handleAddTask}
                onCancel={() => {
                  setShowTaskForm(false);
                  setCurrentTask(null);
                } } householdId={''}              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}