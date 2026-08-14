import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Invoice Workbench',
  description: '本地优先的 PDF 发票批量整理与结构化导出工具'
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
