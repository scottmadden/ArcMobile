// app/layout.tsx
import './styles/globals.css'; // ensure Tailwind is included
import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient();

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body className="bg-[#F7F9FC] text-[#1F2937]">
        <QueryClientProvider client={queryClient}>
          <div className="min-h-screen max-w-xl mx-auto p-6">
            {children}
          </div>
          {/* Devtools only in non-prod if you want */}
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </body>
    </html>
  );
}
