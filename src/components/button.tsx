"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  asChild?: boolean;
}

export const buttonVariants = cva(
  "relative inline-flex items-center justify-center font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed gap-2 rounded-xl isolate overflow-hidden",
  {
    variants: {
      variant: {
        primary: [
          "bg-[oklch(0.53_0.26_254)] text-white",
          // before/after pseudo elements (shimmer effect)
          "before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-b before:from-[oklch(1_0_0_/_0.08)] before:to-[oklch(1_0_0_/_0.02)] before:pointer-events-none",
          "after:absolute after:inset-0 after:rounded-xl after:bg-gradient-to-r after:from-transparent after:via-[oklch(1_0_0_/_0.12)] after:to-transparent after:opacity-0 hover:after:opacity-100 after:transition-opacity",
          "hover:scale-[1.03] active:scale-[0.98]",
        ].join(" "),
        secondary: [
          "bg-[oklch(0.27_0.05_240)] text-white",
          "before:absolute before:inset-0 before:rounded-xl before:bg-gradient-to-b before:from-[oklch(1_0_0_/_0.1)] before:to-[oklch(1_0_0_/_0.03)] before:pointer-events-none",
          "hover:scale-[1.02] active:scale-[0.97]",
        ].join(" "),
        ghost: [
          "bg-transparent text-[oklch(0.53_0.26_254)] hover:bg-[oklch(0.53_0.26_254_/_0.1)]",
        ].join(" "),
        outline: [
          "border border-[oklch(0.53_0.26_254)] text-[oklch(0.53_0.26_254)] bg-transparent",
          "before:absolute before:inset-0 before:rounded-xl before:bg-[oklch(0.53_0.26_254_/_0.05)] before:pointer-events-none",
          "hover:bg-[oklch(0.53_0.26_254_/_0.08)]",
        ].join(" "),
        danger: [
          "bg-[oklch(0.65_0.26_30)] text-white hover:bg-[oklch(0.6_0.25_30)]",
        ].join(" "),
        subtle: [
          "bg-[oklch(0.9_0.02_250)] text-[oklch(0.25_0.05_250)] hover:bg-[oklch(0.85_0.02_250)]",
        ].join(" "),
      },
      size: {
        sm: "px-3 py-2 text-sm",
        md: "px-5 py-2.5 text-base",
        lg: "px-6 py-3 text-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
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
    const Comp = asChild ? Slot : "button";

    return (
      <Comp
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
      >
        <span className="relative z-[1] inline-flex items-center gap-2">
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

Button.displayName = "Button";
