import { Bricolage_Grotesque, JetBrains_Mono, Space_Grotesk } from 'next/font/google';

export const fontDisplay = Bricolage_Grotesque({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display-family',
  axes: ['opsz'],
});

export const fontBody = Space_Grotesk({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body-family',
});

export const fontMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono-family',
});
