import React from 'react';
import { cn } from '@/lib/utils';

import { Slot } from '@radix-ui/react-slot';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'subtle';
    size?: 'sm' | 'md' | 'lg';
    isLoading?: boolean;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    asChild?: boolean;
}

const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-5 py-2.5',
    lg: 'px-6 py-3 text-lg'
};

const baseStyles = 'button inline-flex items-center justify-center font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed gap-2';

const variantStyles = {
    primary: 'button-primary',
    secondary: 'button-secondary',
    ghost: 'button-ghost',
    outline: 'button-outline',
    danger: 'button-danger',
    subtle: 'button-subtle'
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    (
        {
            className,
            variant = 'primary',
            size = 'md',
            isLoading = false,
            leftIcon,
            rightIcon,
            children,
            disabled,
            asChild = false,
            ...props
        },
        ref
    ) => {
        const Comp = asChild ? Slot : 'button';
        return (
            <Comp
                ref={ref}
                disabled={disabled || isLoading}
                className={cn(
                    baseStyles,
                    variantStyles[variant],
                    sizeClasses[size],
                    className
                )}
                {...props}
            >
                <span className="inline-flex items-center gap-2">
                    {isLoading && (
                        <svg
                            className="animate-spin -ml-1 mr-3 h-4 w-4"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                        >
                            <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                            />
                            <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                        </svg>
                    )}
                    {!isLoading && leftIcon}
                    {children}
                    {!isLoading && rightIcon}
                </span>
            </Comp>
        );
    }
);

Button.displayName = 'Button';