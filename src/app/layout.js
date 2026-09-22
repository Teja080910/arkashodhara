import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Arkasodhara — Software Development & Tech Classes',
  description: 'Arkasodhara is a software development team and tech academy. We build web, mobile and AI products for clients — and teach students the craft through hands-on classes.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
