// components/Providers.tsx
'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Dynamic import of devtools to avoid bundling issues in production builds
const isDev = process.env.NODE_ENV === 'development';
let ReactQueryDevtools: any = null;
if (isDev) {
  // require (not import) so it only resolves at runtime in dev
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ReactQueryDevtools = require('@tanstack/react-query-devtools').ReactQueryDevtools;
}

const queryClient = new QueryClient();

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {isDev && ReactQueryDevtools ? <ReactQueryDevtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}
