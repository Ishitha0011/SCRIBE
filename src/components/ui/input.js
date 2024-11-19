// src/components/ui/input.js

import React from 'react';

// Reusable Input component
export const Input = React.forwardRef(({ type = 'text', className = '', ...props }, ref) => (
  <input
    ref={ref}
    type={type}
    className={`border border-gray-300 dark:border-gray-700 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-300 ${className}`}
    {...props}
  />
));

Input.displayName = 'Input';
