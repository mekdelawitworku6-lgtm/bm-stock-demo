import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/Toast';
import { LanguageProvider } from '@/lib/i18n';
import { StoreProvider } from '@/store/StoreProvider';

export const metadata: Metadata = {
  title: 'BM Stock - Business & Inventory Management',
  description: 'Enterprise inventory, sales, customer management, and multi-branch POS system.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased text-slate-900 bg-[#EAF0F6] min-h-screen">
        <StoreProvider>
          <AuthProvider>
            <LanguageProvider>
              <ToastProvider>{children}</ToastProvider>
            </LanguageProvider>
          </AuthProvider>
        </StoreProvider>
      </body>
    </html>
  );
}
