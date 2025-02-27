// src/app/(dashboard)/profile/page.tsx
'use client';

import { useState, useEffect, ChangeEvent } from 'react';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

export default function ProfilePage() {
  const { data: session, update: updateSession, status } = useSession();
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Initialize form data from session
  useEffect(() => {
    if (session?.user) {
      setFormData({
        ...formData,
        name: session.user.name || '',
        email: session.user.email || '',
      });
      setAvatar(session.user.image || null);
    }
  }, [session]);
  
  // Handle input changes
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    
    // Clear any error/success messages when user starts typing
    if (error) setError('');
    if (success) setSuccess('');
  };
  
  // Handle avatar upload
  const handleAvatarChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('Image size must be less than 2MB');
      return;
    }
    
    // Check file type
    if (!file.type.startsWith('image/')) {
      setError('Only image files are allowed');
      return;
    }
    
    // Create a preview URL for the image
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setAvatar(e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };
  
  // Handle profile update
  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');
    
    try {
      // In a real application, this would be an API call to update the user profile
      // For example:
      const response = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          avatar: avatar,
        }),
      });
      
      // For demo purposes, simulate an API response
      // if (!response.ok) throw new Error('Failed to update profile');
      
      // Update the session with new user info
      await updateSession({
        ...session,
        user: {
          ...session?.user,
          name: formData.name,
          email: formData.email,
          image: avatar,
        },
      });
      
      setSuccess('Profile updated successfully!');
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while updating your profile');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Handle password change
  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');
    
    // Validate passwords
    if (formData.newPassword !== formData.confirmPassword) {
      setError('New passwords do not match');
      setIsSubmitting(false);
      return;
    }
    
    if (formData.newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      setIsSubmitting(false);
      return;
    }
    
    try {
      // In a real application, this would be an API call to change the password
      // For example:
      const response = await fetch('/api/users/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword,
        }),
      });
      
      // For demo purposes, simulate an API response
      // if (!response.ok) throw new Error('Current password is incorrect');
      
      setSuccess('Password changed successfully!');
      setFormData({
        ...formData,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setIsChangingPassword(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while changing your password');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Delete account
  const handleDeleteAccount = async () => {
    if (window.confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      try {
        // In a real application, this would be an API call to delete the user account
        // For example:
        const response = await fetch('/api/users', {
          method: 'DELETE',
        });
        
        // For demo purposes, simulate an API response
        // if (!response.ok) throw new Error('Failed to delete account');
        
        // Redirect to the login page
        router.push('/login');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while deleting your account');
      }
    }
  };
  
  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-6 px-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Account Settings</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left sidebar with avatar and account info */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <div className="flex flex-col items-center">
              <div className="relative mb-4">
                {avatar ? (
                  <Image 
                    src={avatar} 
                    alt={formData.name || 'User'} 
                    width={120} 
                    height={120} 
                    className="rounded-full object-cover"
                  />
                ) : (
                  <div className="bg-gray-200 dark:bg-gray-700 h-32 w-32 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-200 text-2xl font-medium">
                    {formData.name ? formData.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                
                {isEditing && (
                  <div className="absolute bottom-0 right-0">
                    <label 
                      htmlFor="avatar-upload" 
                      className="bg-blue-600 text-white p-2 rounded-full cursor-pointer hover:bg-blue-700"
                    >
                      <svg 
                        className="h-5 w-5" 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" 
                        />
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={2} 
                          d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" 
                        />
                      </svg>
                      <input 
                        id="avatar-upload" 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleAvatarChange}
                      />
                    </label>
                  </div>
                )}
              </div>
              
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">{session?.user?.name}</h2>
              <p className="text-gray-500 dark:text-gray-400">{session?.user?.email}</p>
              
              <div className="mt-6 w-full">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-300">Account created</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {new Date().toLocaleDateString()} {/* This would come from user data */}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600 dark:text-gray-300">Role</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      Member {/* This would come from user data */}
                    </span>
                  </div>
                </div>
                
                <div className="mt-6">
                  <button
                    onClick={() => setIsChangingPassword(prev => !prev)}
                    className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    Change password
                  </button>
                </div>
                
                <div className="mt-2">
                  <button
                    onClick={handleDeleteAccount}
                    className="text-sm text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
                  >
                    Delete account
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Main content with profile form */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Profile Information</h2>
              
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Edit Profile
                </button>
              ) : (
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              )}
            </div>
            
            {/* Success and error messages */}
            {success && (
              <div className="m-6 p-3 bg-green-50 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-md">
                {success}
              </div>
            )}
            
            {error && (
              <div className="m-6 p-3 bg-red-50 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-md">
                {error}
              </div>
            )}
            
            <div className="p-6">
              {/* Profile Information Form */}
              {!isChangingPassword ? (
                <form onSubmit={handleProfileUpdate}>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Full Name
                      </label>
                      <input
                        id="name"
                        name="name"
                        type="text"
                        value={formData.name}
                        onChange={handleInputChange}
                        readOnly={!isEditing}
                        className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                          isEditing ? 'border-gray-300' : 'border-transparent bg-gray-50 dark:bg-gray-800'
                        }`}
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Email Address
                      </label>
                      <input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        readOnly={!isEditing}
                        className={`w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                          isEditing ? 'border-gray-300' : 'border-transparent bg-gray-50 dark:bg-gray-800'
                        }`}
                      />
                    </div>
                    
                    {isEditing && (
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    )}
                  </div>
                </form>
              ) : (
                /* Password Change Form */
                <form onSubmit={handlePasswordChange}>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Current Password
                      </label>
                      <input
                        id="currentPassword"
                        name="currentPassword"
                        type="password"
                        value={formData.currentPassword}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        New Password
                      </label>
                      <input
                        id="newPassword"
                        name="newPassword"
                        type="password"
                        value={formData.newPassword}
                        onChange={handleInputChange}
                        required
                        minLength={8}
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Must be at least 8 characters
                      </p>
                    </div>
                    
                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Confirm New Password
                      </label>
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    </div>
                    
                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setIsChangingPassword(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? 'Changing...' : 'Change Password'}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </div>
          
          {/* Household Information (Optional Section) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden mt-6">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Household Membership</h2>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">123 College Avenue</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Joined August 15, 2023</p>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                    Admin
                  </span>
                </div>
                
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  To join another household, you will need to be invited by an existing member.
                </p>
              </div>
            </div>
          </div>
          
          {/* Notification Preferences (Optional Section) */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden mt-6">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Notification Preferences</h2>
            </div>
            
            <div className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Email Notifications</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Receive updates via email</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Expense Reminders</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Get notified about pending expenses</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">Task Assignment</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Notifications when you're assigned a task</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}