import React, { useState } from "react";
import { cn } from "@/lib/utils";

// Simple tooltip implementation without external dependencies
const TooltipProvider = ({ children }) => children;

const Tooltip = ({ children }) => children;

const TooltipTrigger = ({ asChild, children, ...props }) => {
  if (asChild) {
    return React.cloneElement(children, props);
  }
  return <div {...props}>{children}</div>;
};

const TooltipContent = ({ children, className, ...props }) => {
  return (
    <div
      className={cn(
        "absolute z-50 px-3 py-1.5 text-sm text-white bg-gray-900 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 -top-2 left-1/2 transform -translate-x-1/2 -translate-y-full whitespace-nowrap",
        className
      )}
      {...props}
    >
      {children}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
    </div>
  );
};

// Simple implementation using title attribute as fallback
const SimpleTooltip = ({ children, content, disabled = false }) => {
  if (disabled || !content) return children;
  
  return (
    <div className="relative group inline-block">
      {children}
      <div className="absolute z-50 px-2 py-1 text-xs text-white bg-gray-900 rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 -top-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
        {content}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-gray-900"></div>
      </div>
    </div>
  );
};

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider, SimpleTooltip };