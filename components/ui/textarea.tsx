import * as React from 'react';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...props }, ref) => (
    <textarea
      ref={ref}
      className={`min-h-[84px] w-full rounded-md border p-3 text-sm outline-none focus:ring-2 focus:ring-[#1A73E8] ${className}`}
      {...props}
    />
  )
);
Textarea.displayName = 'Textarea';
export default Textarea;
