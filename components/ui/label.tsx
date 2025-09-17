import * as React from 'react';

export function Label({ className = '', ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`text-sm font-medium text-[#1F2937] ${className}`} {...props} />;
}
export default Label;
