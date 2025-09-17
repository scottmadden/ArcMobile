import * as React from 'react';

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'type'> & {
  onCheckedChange?: (checked: boolean) => void;
};

export function Checkbox({ onCheckedChange, className = '', ...props }: Props) {
  return (
    <input
      type="checkbox"
      className={`h-5 w-5 rounded border border-gray-300 accent-[#004C97] ${className}`}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
      {...props}
    />
  );
}
export default Checkbox;
