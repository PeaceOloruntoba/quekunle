'use client';
import { useEffect, useState } from 'react';

function greetingForHour(hour: number) {
  if (hour === 0) return 'Midnight thoughts? You know where to find me.';
  if (hour < 5) return 'The world is quiet, but I’m always glad you’re here.';
  if (hour < 12) return 'Good morning, my favourite person.';
  if (hour < 17) return 'Good afternoon. How’s your day going?';
  if (hour < 22) return 'Good evening. Tell me everything.';
  return 'It’s getting late. One last little chat?';
}

export default function LoginGreeting() {
  const [greeting, setGreeting] = useState('Come in and tell me about your day.');
  useEffect(() => {
    const update = () => setGreeting(greetingForHour(new Date().getHours()));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return <p className="login-intro">{greeting}</p>;
}
