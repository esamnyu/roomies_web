// src/components/tasks/TaskForm.tsx
'use client';

import { useState, useEffect } from 'react';

interface Member {
  id: string;
  name: string;
  avatar?: string;
}

interface Task {
  id?: string;
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

interface TaskFormProps {
  task?: Task | null;
  members: Member[];
  onSubmit: (task: Task) => void;
  onCancel: () => void;
}

export default function TaskForm({ task, members, onSubmit, onCancel }: TaskFormProps) {
  // For demo purposes, assuming current user is user1
  const currentUserId = '1';
  const currentUser = members.find(m => m.id === currentUserId);
  
  // Default state for a new task
  const defaultState = {
    title: '',
    description: '',
    status: 'PENDING' as const,
    priority: 'MEDIUM' as const,
    creatorId: currentUserId,
    assigneeId: '',
    dueDate: '',
    recurring: false,
    recurrenceRule: 'WEEKLY',
    householdId: '1', // Assuming we have a single household for now
  };

  const [formData, setFormData] = useState<Omit<Task, 'dueDate'> & { dueDate: string }>(defaultState);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Initialize form data when task prop changes
  useEffect(() => {
    if (task) {
      setFormData({
        ...task,
        dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '', // Convert Date to YYYY-MM-DD
        recurrenceRule: task.recurrenceRule || 'WEEKLY',
      });
    } else {
      setFormData(defaultState);
    }
  }, [task]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      const checkbox = e.target as HTMLInputElement;
      setFormData({ ...formData, [name]: checkbox.checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
    
    // Clear error when field is edited
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }
    
    if (!formData.assigneeId) {
      newErrors.assigneeId = 'Please select an assignee';
    }
    
    if (formData.recurring && !formData.recurrenceRule) {
      newErrors.recurrenceRule = 'Please select a recurrence pattern';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    // Submit the task
    onSubmit({
      ...formData,
      dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined, // Convert string back to Date
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-4">
      <div>
        <label 
          htmlFor="title" 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Title
        </label>
        <input
          id="title"
          name="title"
          type="text"
          value={formData.title}
          onChange={handleInputChange}
          placeholder="e.g., Clean the kitchen, Take out trash"
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
        {errors.title && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.title}</p>}
      </div>
      
      <div>
        <label 
          htmlFor="description" 
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Description (Optional)
        </label>
        <textarea
          id="description"
          name="description"
          value={formData.description || ''}
          onChange={handleInputChange}
          rows={3}
          placeholder="Add details about the task..."
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label 
            htmlFor="assigneeId" 
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Assign To
          </label>
          <select
            id="assigneeId"
            name="assigneeId"
            value={formData.assigneeId || ''}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="">Select a person</option>
            {members.map(member => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
          {errors.assigneeId && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.assigneeId}</p>}
        </div>
        
        <div>
          <label 
            htmlFor="priority" 
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Priority
          </label>
          <select
            id="priority"
            name="priority"
            value={formData.priority}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label 
            htmlFor="dueDate" 
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Due Date
          </label>
          <input
            id="dueDate"
            name="dueDate"
            type="date"
            value={formData.dueDate}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
        
        <div>
          <label 
            htmlFor="status" 
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Status
          </label>
          <select
            id="status"
            name="status"
            value={formData.status}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="PENDING">Pending</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="SKIPPED">Skipped</option>
          </select>
        </div>
      </div>
      
      <div className="flex items-center mt-2">
        <input
          id="recurring"
          name="recurring"
          type="checkbox"
          checked={formData.recurring}
          onChange={handleInputChange}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="recurring" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
          Recurring task
        </label>
      </div>
      
      {formData.recurring && (
        <div>
          <label 
            htmlFor="recurrenceRule" 
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Recurrence Pattern
          </label>
          <select
            id="recurrenceRule"
            name="recurrenceRule"
            value={formData.recurrenceRule}
            onChange={handleInputChange}
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="BIWEEKLY">Every 2 weeks</option>
            <option value="MONTHLY">Monthly</option>
          </select>
          {errors.recurrenceRule && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.recurrenceRule}</p>}
        </div>
      )}
      
      <div className="flex justify-end mt-6 gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          {task ? 'Update Task' : 'Create Task'}
        </button>
      </div>
    </form>
  );
}