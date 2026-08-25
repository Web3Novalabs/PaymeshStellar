import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Layout from '@/components/Layout';
import { WalletProvider } from '@/contexts/WalletContext';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Paymesh - Stellar Payroll',
  description: 'Decentralised payroll management on Stellar',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <WalletProvider>
          <Layout>{children}</Layout>
        </WalletProvider>
      </body>
    </html>
  );
}
