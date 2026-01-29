import React from 'react';
import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

const maxWidthClasses = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-6xl',
  full: 'max-w-full',
};

export function PageContainer({ 
  children, 
  className,
  maxWidth = 'lg' 
}: PageContainerProps) {
  return (
    <div 
      className={cn(
        "min-h-screen bg-background px-4 py-6 safe-area-padding",
        "md:px-6 md:py-8",
        className
      )}
    >
      <div className={cn("mx-auto", maxWidthClasses[maxWidth])}>
        {children}
      </div>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  backButton?: React.ReactNode;
  className?: string;
}

export function PageHeader({ 
  title, 
  subtitle, 
  action, 
  backButton,
  className 
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6 md:mb-8", className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {backButton}
          <div>
            <h1 className="text-2xl font-bold text-foreground">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-base text-muted-foreground">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    </div>
  );
}
