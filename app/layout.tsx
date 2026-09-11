import { ThemeProvider } from '@/components/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ClerkProvider } from '@clerk/nextjs';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';
import { QueryProvider } from '@/components/query-provider';

const geistSans = Geist({
 variable: '--font-geist-sans',
 subsets: ['latin'],
});

const geistMono = Geist_Mono({
 variable: '--font-geist-mono',
 subsets: ['latin'],
});

export const metadata: Metadata = {
 title: 'Fuzzy.ai | Social Media Scheduling',
 description:
  'Create AI-powered social media scheduling for every platform in seconds. Fuzzy.ai is a platform that allows you to create social media scheduling for every platform in seconds.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
 return (
  <html
   lang="en"
   className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
   suppressHydrationWarning
   style={
    {
     '--font-sans': geistSans.style.fontFamily,
     '--font-mono': geistMono.style.fontFamily,
    } as React.CSSProperties
   }
  >
   <head />
   <body className="min-h-full flex flex-col">
    <ClerkProvider>
     <QueryProvider>
      <ThemeProvider
       attribute="class"
       defaultTheme="system"
       enableSystem
       disableTransitionOnChange
      >
       <TooltipProvider>
        {children}
        <Toaster richColors />
       </TooltipProvider>
      </ThemeProvider>
     </QueryProvider>
    </ClerkProvider>
   </body>
  </html>
 );
}
