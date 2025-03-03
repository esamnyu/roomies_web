// src/lib/utils.ts

/**
 * Generates a UUID v4 string
 * This can be used for creating unique IDs for database records
 * @returns {string} A UUID v4 string
 */
export function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  /**
   * Format a date for display
   * @param date Date to format
   * @param includeTime Whether to include the time
   * @returns Formatted date string
   */
  export function formatDate(date: Date | string, includeTime: boolean = false): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    if (includeTime) {
      return dateObj.toLocaleString();
    }
    
    return dateObj.toLocaleDateString();
  }
  
  /**
   * Truncate a string to a specific length and add ellipsis if needed
   * @param str String to truncate
   * @param length Maximum length
   * @returns Truncated string
   */
  export function truncate(str: string, length: number): string {
    if (str.length <= length) return str;
    return str.slice(0, length) + '...';
  }
  
  /**
   * Delay execution for a specified number of milliseconds
   * Useful for throttling or creating intentional delays
   * @param ms Milliseconds to delay
   * @returns Promise that resolves after the specified time
   */
  export function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Check if a value is empty (null, undefined, empty string, or empty array)
   * @param value Value to check
   * @returns True if the value is empty
   */
  export function isEmpty(value: any): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim() === '';
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  }