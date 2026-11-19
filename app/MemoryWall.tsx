'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Camera, Check, Heart, ImagePlus, MapPin, Plus, Sparkles } from 'lucide-react';

type Media = { id: number; name: string; type: string; url: string };
type Contribution = { user_id: string; name: string; body: string };
type Memory = { id: number; title: string; location: string; happened_on: string; is_public: boolean; created_by: string; creator_name: string; contributions: Contribution[]; media: Media[] };
const today = new Date().toISOString().slice(0, 10);
export default function MemoryWall({ mode }: { mode: 'private' | 'gallery' }) {
  const privateView = mode === 'private';
  const [memories, setMemories] = useState<Memory[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [form, setForm] = useState({ title: '', location: '', happened_on: today, story: '', is_public: false });
  const [notes, setNotes] = useState<Record<number, string>>({});
  useEffect(() => { void load(); }, []);
  async function load() {
    try {
      const response = await fetch(privateView ? '/api/memories' : '/api/memories?scope=public', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMemories(result.memories ?? []); setMe(result.me ?? null);
      setNotes(Object.fromEntries((result.memories ?? []).map((memory: Memory) => [memory.id, memory.contributions.find(item => item.user_id === result.me)?.body ?? ''])));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not load the memories.'); }
  }
  async function createMemory(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (files.length > 8) throw new Error('Choose up to 8 photos or videos.');
      const media = await Promise.all(files.map(async file => {
        const ticketResponse = await fetch('/api/memories/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: file.type, size: file.size }) });
        const ticket = await ticketResponse.json();
        if (!ticketResponse.ok) throw new Error(ticket.error);
        const upload = await fetch(ticket.uploadUrl, { method: 'PUT', headers: { 'Content-Type': ticket.type }, body: file });
        if (!upload.ok) throw new Error(`Could not upload ${file.name}. Check Object Storage and try again.`);
        return { key: ticket.key, name: file.name, type: ticket.type };
      }));
      const response = await fetch('/api/memories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, media }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setForm({ title: '', location: '', happened_on: today, story: '', is_public: false }); setFiles([]);
      setNotice('Your memory is tucked away safely.'); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save this memory.'); }
    finally { setBusy(false); }
  }
  async function saveNote(memory: Memory) {
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/memories/${memory.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ story: notes[memory.id] ?? '', is_public: memory.is_public }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.error);
      setNotice('Your note is saved.'); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save your note.'); }
    finally { setBusy(false); }
  }
  async function setVisibility(memory: Memory, is_public: boolean) {
    setMemories(current => current.map(item => item.id === memory.id ? { ...item, is_public } : item));
    try {
      const response = await fetch(`/api/memories/${memory.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ story: notes[memory.id] ?? '', is_public }) });
      if (!response.ok) throw new Error();
      setNotice(is_public ? 'This memory is now in the public gallery.' : 'This memory is private again.');
    } catch { setMemories(current => current.map(item => item.id === memory.id ? { ...item, is_public: !is_public } : item)); setError('Could not change this memory’s visibility.'); }
  }
  return <main className="memory-page">
    <header className="memory-header"><Link href="/" className="brand">q<span>♥</span></Link><nav><Link href="/">Our story</Link>{privateView ? <Link href="/gallery">Public gallery <ArrowUpRight size={14}/></Link> : <Link href="/memories">Our memories <Heart size={14}/></Link>}</nav></header>
    <section className="memory-hero"><span className="eyebrow"><Sparkles size={14}/> {privateView ? 'A PRIVATE LITTLE CORNER' : 'LITTLE MOMENTS, KEPT CLOSE'}</span><h1>{privateView ? <>Our memory<br/><em>book.</em></> : <>The memory<br/><em>gallery.</em></>}</h1><p>{privateView ? 'Save the places, pictures, and small details you never want to forget. Add your own words to each memory.' : 'A few favourite moments from our little world, shared with love.'}</p></section>
    {privateView && <form className="memory-form" onSubmit={createMemory}><div className="memory-form-title"><Camera size={19}/><div><strong>Save a new memory</strong><span>A day, a place, a feeling worth keeping.</span></div></div><div className="memory-form-grid"><label>What should we call it?<input required maxLength={120} placeholder="A day by the sea" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/></label><label>Where did you go?<span className="memory-location"><MapPin size={15}/><input maxLength={180} placeholder="A place we loved" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}/></span></label><label>When was it?<input type="date" required value={form.happened_on} onChange={e => setForm({ ...form, happened_on: e.target.value })}/></label><label className="memory-story-label">Your little note<textarea rows={3} maxLength={1200} placeholder="What do you want to remember about this day?" value={form.story} onChange={e => setForm({ ...form, story: e.target.value })}/></label></div><label className="memory-upload"><ImagePlus size={18}/><span><strong>Add photos or videos</strong><small>Up to 8 files · JPEG, PNG, WebP, HEIC, MP4, WebM, or MOV · 50 MB each</small></span><input type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/webm,video/quicktime" onChange={e => setFiles(Array.from(e.target.files ?? []).slice(0, 8))}/></label>{files.length > 0 && <div className="memory-file-list">{files.map(file => <span key={`${file.name}-${file.size}`}>{file.name}</span>)}</div>}<label className="memory-public-toggle"><input type="checkbox" checked={form.is_public} onChange={e => setForm({ ...form, is_public: e.target.checked })}/> Share this memory in the public gallery</label><button className="button button-green" disabled={busy}><Plus size={16}/>{busy ? 'Saving memory…' : 'Keep this memory'}</button></form>}
    {notice && <p className="memory-notice"><Check size={15}/>{notice}</p>}{error && <p className="settings-error memory-notice">{error}</p>}
    <section className="memory-grid" aria-live="polite">{memories.map((memory, index) => <article className="memory-card" key={memory.id} style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}><div className="memory-media">{memory.media.length ? memory.media.map(item => item.type.startsWith('video/') ? <video key={item.id} src={item.url} controls preload="metadata"/> : <a key={item.id} href={item.url} target="_blank" rel="noreferrer" aria-label={`Open ${item.name}`}><img src={item.url} alt={item.name} loading="lazy"/></a>) : <div className="memory-no-media"><Heart size={30}/><span>one for the heart</span></div>}</div><div className="memory-card-copy"><time>{new Date(`${memory.happened_on}T12:00:00`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</time><h2>{memory.title}</h2>{memory.location && <p className="memory-place"><MapPin size={14}/>{memory.location}</p>}{memory.contributions.map(item => <blockquote key={item.user_id}><strong>{item.name}</strong><p>{item.body}</p></blockquote>)}{privateView && <div className="memory-own-note"><label>Your note<textarea rows={2} maxLength={1200} value={notes[memory.id] ?? ''} onChange={e => setNotes({ ...notes, [memory.id]: e.target.value })} placeholder="Add your side of this memory…"/></label><div className="memory-manage-row"><button type="button" className="memory-save-note" onClick={() => saveNote(memory)} disabled={busy}>Save my note</button><label className="memory-public-toggle"><input type="checkbox" checked={memory.is_public} onChange={e => setVisibility(memory, e.target.checked)}/> Public</label></div></div>}<span className="memory-kept"><Heart size={13} fill="currentColor"/> {privateView ? memory.is_public ? 'Shared in gallery' : `Remembered by ${memory.creator_name}` : 'A little piece of us'}</span></div></article>)}{memories.length === 0 && <div className="memory-empty"><span>♡</span><h2>{privateView ? 'Your pages are waiting.' : 'The gallery is just beginning.'}</h2><p>{privateView ? 'Add your first shared memory above, then tell the story in your own words.' : 'The moments you choose to share will find their way here.'}</p></div>}</section>
    <footer className="memory-footer">Made for the moments that make us <Heart size={13} fill="currentColor"/></footer>
  </main>;
}
