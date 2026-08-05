import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vardhnam Business Portal',
  description: 'Phase 1C onboarding approval and audit portal for Vardhnam Agrotech.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  );
}
