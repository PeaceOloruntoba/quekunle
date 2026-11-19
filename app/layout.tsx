import type { Metadata, Viewport } from 'next';
import './globals.css';
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#287a50' };
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://quekunle.vercel.app'),
  title: 'Quekunle — A little world for two',
  description: 'A little private corner for Queen Moyosore and Peace Adekunle. Just the two of us, always in conversation.',
  keywords: ['Quekunle', 'private chat', 'Queen Moyosore', 'Peace Adekunle'],
  openGraph: { title: 'Quekunle — A little world for two', description: 'A private little corner made for two.', type: 'website' },
  robots: { index: true, follow: true },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
