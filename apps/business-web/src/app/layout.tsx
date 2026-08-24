import type { Metadata } from 'next';
import { portalThemeStyle } from '../lib/portal-theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vardhnam Business Portal',
  description:
    'Managed agriculture marketplace portal for Vardhnam Agrotech — onboarding, catalogue, inventory, orders, finance and operations.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-IN" style={portalThemeStyle}>
      <body>{children}</body>
    </html>
  );
}
