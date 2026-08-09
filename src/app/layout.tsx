import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';
import { getAppMetadata } from '@/lib/app-metadata';

const app = getAppMetadata();

export const metadata: Metadata = {
  title: 'منصة التطوير المهني المستمر',
  description: 'حوكمة أنشطة التطوير المهني والجاهزية للاعتماد وذكاء الأثر',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang={app.locale} dir={app.direction}>
      <body>{children}</body>
    </html>
  );
}
