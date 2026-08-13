import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import Classes from '@/components/Classes';
import Projects from '@/components/Projects';
import Testimonials from '@/components/Testimonials';
import Contact from '@/components/Contact';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <main className="bg-ink-900 min-h-screen">
      <Navbar />
      <Hero />
      <Classes />
      <Projects />
      <Testimonials />
      <Contact />
      <Footer />
    </main>
  );
}
