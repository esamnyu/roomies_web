// src/components/ui/Card.tsx
import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  title?: string | ReactNode;
  footer?: ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  noPadding?: boolean;
}

export default function Card({
  children,
  title,
  footer,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  footerClassName = '',
  noPadding = false
}: CardProps) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden ${className}`}>
      {title && (
        <div className={`border-b border-gray-200 dark:border-gray-700 px-4 py-3 ${headerClassName}`}>
          {typeof title === 'string' ? (
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">{title}</h3>
          ) : (
            title
          )}
        </div>
      )}
      
      <div className={`${noPadding ? '' : 'p-4'} ${bodyClassName}`}>
        {children}
      </div>
      
      {footer && (
        <div className={`border-t border-gray-200 dark:border-gray-700 px-4 py-3 ${footerClassName}`}>
          {footer}
        </div>
      )}
    </div>
  );
}

// Additional card-related components for more complex layouts
export function CardHeader({ 
  children, 
  className = '' 
}: { 
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-b border-gray-200 dark:border-gray-700 px-4 py-3 ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ 
  children,
  className = ''
}: { 
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3 className={`text-lg font-medium text-gray-900 dark:text-white ${className}`}>
      {children}
    </h3>
  );
}

export function CardBody({ 
  children,
  className = ''
}: { 
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`p-4 ${className}`}>
      {children}
    </div>
  );
}

export function CardFooter({ 
  children,
  className = ''
}: { 
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-t border-gray-200 dark:border-gray-700 px-4 py-3 ${className}`}>
      {children}
    </div>
  );
}