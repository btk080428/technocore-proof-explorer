import type { Metadata } from 'next';
import { headers } from 'next/headers';
import './globals.css';

const title = 'Technocore Proof Explorer';
const description = 'Explore public Technocore DIDs, signed activity, artifacts, and contribution receipts.';

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') || '';
  const trustedHost = /^(localhost(?::\d+)?|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:openai\.com|openai\.site|chatgpt\.site))$/i.test(host);
  const origin = trustedHost ? `${host.startsWith('localhost') ? 'http' : 'https'}://${host}` : null;
  const image = origin ? `${origin}/og.png` : undefined;
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', images: image ? [{ url: image, width: 1200, height: 630 }] : [] },
    twitter: { card: 'summary_large_image', title, description, images: image ? [image] : [] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
