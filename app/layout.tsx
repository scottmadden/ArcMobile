// app/layout.tsx
import './styles/globals.css';
import Providers from '../components/Providers'; // adjust path if your components/ folder is elsewhere
import type { ReactNode } from 'react';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head />
      <body>
        <div className="app-container min-h-screen">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
