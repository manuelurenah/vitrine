import type { Metadata, Viewport } from 'next';
import { fontBody, fontDisplay, fontMono } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'vitrine · campaigns powered by civitai',
  description:
    'drop a photo. ship a campaign. one product shot becomes posts, ads, and a hero video — paid in buzz.',
};

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable}`}
    >
      <body className="bg-bg-0 text-fg-0 antialiased">{children}</body>
    </html>
  );
}
