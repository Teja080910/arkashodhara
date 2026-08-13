import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Arkasodhara — Classes & Project Management',
  description: 'Learn, build and manage your projects with Arkasodhara. Expert-led classes and a powerful project management platform.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
