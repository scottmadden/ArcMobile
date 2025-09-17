import './globals.css';
import ReactQueryProvider from '../components/providers/ReactQueryProvider';

export const metadata = {
  title: 'ArcMobile',
  description: 'Food-truck compliance made simple.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ReactQueryProvider>{children}</ReactQueryProvider>
      </body>
    </html>
  );
}
