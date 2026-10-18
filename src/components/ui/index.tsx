import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onPress?: () => void;
  isDisabled?: boolean;
  variant?: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg' | string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ onPress, onClick, isDisabled, disabled, className = '', children, ...props }, ref) => {
    const isActuallyDisabled = isDisabled || disabled;
    return (
      <button
        ref={ref}
        disabled={isActuallyDisabled}
        onClick={(e) => {
          if (isActuallyDisabled) return;
          if (onPress) onPress();
          if (onClick) onClick(e);
        }}
        className={className}
        {...props}
      >
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={className} {...props}>
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}
export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', children, ...props }, ref) => (
    <div ref={ref} className={className} {...props}>
      {children}
    </div>
  )
);
CardHeader.displayName = 'CardHeader';

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}
export const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className = '', children, ...props }, ref) => (
    <div ref={ref} className={className} {...props}>
      {children}
    </div>
  )
);
CardContent.displayName = 'CardContent';

export interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: 'sm' | 'md' | 'lg' | string;
  variant?: string;
  color?: string;
}

export const Chip = React.forwardRef<HTMLSpanElement, ChipProps>(
  ({ size, variant, color, className = '', children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={`inline-flex items-center justify-center font-medium rounded-full ${className}`}
        {...props}
      >
        {children}
      </span>
    );
  }
);
Chip.displayName = 'Chip';
