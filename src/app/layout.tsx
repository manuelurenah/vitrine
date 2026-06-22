import type { Metadata, Viewport } from 'next';
import { PreferencesProvider } from '@/components/PreferencesProvider';
import { ToastProvider } from '@/components/ui';
import { fontBody, fontDisplay, fontMono } from './fonts';
import './globals.css';

export const metadata: Metadata = {
  title: 'vitrine · campaigns powered by civitai',
  description:
    'drop a photo. ship a campaign. one product shot becomes posts, ads, and a hero video — paid in buzz.',
};

export const viewport: Viewport = {
  themeColor: '#0a0a0f',
  viewportFit: 'cover',
};

// Runs before first paint — reads localStorage and resolves the theme (incl.
// `system` via prefers-color-scheme) to avoid a flash of the wrong theme.
// Must stay tiny and inline.
const noFlashScript = `(function(){try{var t=localStorage.getItem('vitrine-theme');var r=(t==='light'||t==='dark')?t:(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.dataset.theme=r;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable}`}
    >
      {/* eslint-disable-next-line react/no-danger */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className="bg-bg-0 text-fg-0 antialiased">
        <PreferencesProvider>
          <ToastProvider>{children}</ToastProvider>
        </PreferencesProvider>
      </body>
    </html>
  );
}
