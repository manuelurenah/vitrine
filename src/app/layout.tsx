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

// Runs before first paint — reads localStorage and sets data-theme to avoid a
// flash of the wrong theme. Must stay tiny and inline.
const noFlashScript = `(function(){try{var t=localStorage.getItem('vitrine-theme');document.documentElement.dataset.theme=t==='light'?'light':'dark';}catch(e){}})();`;

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
      <body className="bg-bg-0 text-fg-0 antialiased">{children}</body>
    </html>
  );
}
