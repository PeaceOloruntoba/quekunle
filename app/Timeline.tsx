'use client';
import { useEffect, useRef } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import { displayDate } from '@/lib/date-only';

export type TimelineEntry = { id: number; happened_on: string; title: string; story: string };
export default function Timeline({ events }: { events: TimelineEntry[] }) {
  const track = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const cards = Array.from(element.querySelectorAll<HTMLElement>('.timeline-card'));
    if (!('IntersectionObserver' in window)) { cards.forEach(card => card.classList.add('is-visible')); return; }
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -35px 0px' });
    element.classList.add('timeline-ready');
    cards.forEach(card => observer.observe(card));
    return () => observer.disconnect();
  }, [events.length]);
  return <section className="our-timeline wrap" id="our-timeline"><div className="section-head timeline-section-head"><span className="eyebrow"><Sparkles size={13}/> A FEW PAGES IN OUR STORY</span><h2>Our timeline.</h2><p>The little moments that brought us here.</p></div>{events.length ? <div className="timeline-track" ref={track}>{events.map((event, index) => <article className="timeline-card" key={event.id} style={{ ['--timeline-index' as string]: index }}><span className="timeline-heart"><Heart size={11} fill="currentColor"/></span><time>{displayDate(event.happened_on)}</time><h3>{event.title}</h3>{event.story && <p>{event.story}</p>}<span className="timeline-sparkle">✦</span></article>)}</div> : <div className="timeline-empty"><span>♡</span><strong>Our story is still unfolding.</strong><p>We’ll fill these pages with the days, places, and little moments we want to keep.</p></div>}</section>;
}
