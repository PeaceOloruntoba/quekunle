import Link from 'next/link';
import { ArrowRight, Heart, Leaf, LockKeyhole, Sparkles } from 'lucide-react';
import { getSession } from '@/lib/auth';

export default async function Home() {
  const session = await getSession();
  return <main className="landing">
    <nav className="nav wrap"><Link className="brand" href="/">q<span>♥</span></Link><a className="nav-link" href="#our-story">Our little story <ArrowRight size={15}/></a></nav>
    <section className="hero wrap">
      <div className="hero-copy"><span className="eyebrow"><span className="live-dot"/> JUST US, ALWAYS</span><h1>A little world<br/>for <em>two.</em></h1><p className="hero-lede">A quiet corner of the internet, made for the best conversations with my favourite person.</p><Link className="button button-green" href={session ? '/chat' : '/login'}>{session ? 'Open our chat' : 'Come on in'} <ArrowRight size={17}/></Link><div className="privacy-note"><LockKeyhole size={14}/> A private space for Queen & Peace</div></div>
      <div className="hero-art" aria-label="An illustrated green garden"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="sparkle s-one">✳</div><div className="sparkle s-two">✦</div><div className="sun"/><div className="hill hill-back"/><div className="hill hill-front"/><div className="flower flower-one">✿</div><div className="flower flower-two">✿</div><div className="center-heart"><Heart fill="currentColor" size={28}/></div><div className="art-caption">a place that feels like us</div></div>
    </section>
    <section className="story wrap" id="our-story"><div className="section-head"><span className="eyebrow">THE PEOPLE IN THIS LITTLE WORLD</span><h2>Two hearts, one chat.</h2><p>Different shades, same wavelength.</p></div><div className="people-grid"><article className="person-card queen"><div className="person-top"><div className="avatar avatar-queen">Q<span>✿</span></div><span className="person-symbol">✳</span></div><div className="person-label">THE GREEN HEART</div><h3>Queen Moyosore</h3><p>She brings the warmth, the wonder, and all the green things that make life feel a little more lovely.</p><span className="person-tag">Queen of my little world <Heart size={13} fill="currentColor"/></span></article><article className="person-card peace"><div className="person-top"><div className="avatar avatar-peace">P<span>✦</span></div><span className="person-symbol">◒</span></div><div className="person-label">THE BLUE HEART</div><h3>Peace Adekunle</h3><p>He made this little corner of the internet, with a blue heart and one very important person in mind.</p><span className="person-tag">Her favourite person <Heart size={13} fill="currentColor"/></span></article></div></section>
    <section className="closing wrap"><div><Sparkles size={20}/><span>Every good story deserves its own little space.</span></div><Link className="button button-light" href={session ? '/chat' : '/login'}>Let’s talk <ArrowRight size={16}/></Link></section>
    <footer className="footer wrap"><Link className="brand" href="/">q<span>♥</span></Link><p>Made for two, with a whole lot of heart.</p><span>Built with love by <a href="https://peacecodes.pages.dev" target="_blank" rel="noreferrer">peacecodes</a> <Heart size={12} fill="currentColor"/></span></footer>
  </main>;
}
