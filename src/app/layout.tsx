import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { getElectionConfigAsync } from '@/lib/election-config-store';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const config = await getElectionConfigAsync();
    const titulo = config.tituloProceso?.trim() || 'Portal de Votación';
    const institucion = config.nombreInstitucion?.trim() || 'Plataforma Electoral';
    return {
      title: `${titulo} | ${institucion}`,
      description: `Portal oficial de votación digital — ${titulo} (${institucion}).`,
      robots: { index: false, follow: false },
    };
  } catch {
    return {
      title: 'Portal de Votación Digital',
      description: 'Plataforma modular de votación digital.',
      robots: { index: false, follow: false },
    };
  }
}

interface RootLayoutProps {
  children: React.ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  // Calling headers() forces dynamic rendering per-request. Next.js then reads
  // the x-nonce header (set by middleware) and automatically injects it as a
  // nonce attribute on all generated <script> tags, satisfying the CSP policy.
  await headers();

  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
