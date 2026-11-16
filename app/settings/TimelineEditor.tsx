'use client';
import { useEffect, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { displayDate } from '@/lib/date-only';

type Event = { id: number; happened_on: string; title: string; story: string };
const empty = { happened_on: '', title: '', story: '' };
export default function TimelineEditor() {
  const [events, setEvents] = useState<Event[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { fetch('/api/timeline').then(r => r.json()).then(data => setEvents((data.events ?? []).map((event: Event) => ({ ...event, happened_on: String(event.happened_on).slice(0, 10) })))).catch(() => setError('Could not load the timeline.')); }, []);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(editing ? `/api/timeline/${editing}` : '/api/timeline', { method: editing ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const saved = { ...result.event, happened_on: String(result.event.happened_on).slice(0, 10) } as Event;
      setEvents(current => [...current.filter(item => item.id !== saved.id), saved].sort((a, b) => a.happened_on.localeCompare(b.happened_on) || a.id - b.id));
      setForm(empty); setEditing(null); setNotice(editing ? 'Story moment updated.' : 'A new story moment was added.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save that moment.'); }
    finally { setBusy(false); }
  }
  async function remove(id: number) {
    if (!confirm('Remove this moment from your timeline?')) return;
    const response = await fetch(`/api/timeline/${id}`, { method: 'DELETE' });
    if (response.ok) setEvents(current => current.filter(event => event.id !== id));
    else setError('Could not remove that moment.');
  }
  return <section className="settings-section timeline-editor">
    <div className="settings-section-heading"><div className="settings-icon">♡</div><div><h2>Our little timeline</h2><p>Add the dates and moments that make our story ours. Both of you can edit it anytime.</p></div></div>
    <div className="timeline-editor-list">{events.map(event => <article key={event.id}><time>{displayDate(event.happened_on, { month: 'short', day: 'numeric', year: 'numeric' })}</time><div><strong>{event.title}</strong><p>{event.story}</p></div><button type="button" aria-label={`Edit ${event.title}`} onClick={() => { setEditing(event.id); setForm({ happened_on: event.happened_on, title: event.title, story: event.story }); }}><Pencil size={15}/></button><button type="button" aria-label={`Remove ${event.title}`} onClick={() => remove(event.id)}><Trash2 size={15}/></button></article>)}</div>
    <form className="timeline-form" onSubmit={save}><label>Date<input type="date" required value={form.happened_on} onChange={e => setForm({ ...form, happened_on: e.target.value })}/></label><label>Moment<input required maxLength={120} placeholder="The day our paths crossed" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}/></label><label>A little note<textarea rows={2} maxLength={800} placeholder="What do you want to remember about it?" value={form.story} onChange={e => setForm({ ...form, story: e.target.value })}/></label><div className="timeline-form-actions"><button className="button button-green" disabled={busy}><Check size={15}/>{busy ? 'Saving…' : editing ? 'Save changes' : <><Plus size={15}/> Add moment</>}</button>{editing && <button type="button" className="timeline-cancel" onClick={() => { setEditing(null); setForm(empty); }}><X size={15}/> Cancel</button>}</div></form>
    {notice && <p className="settings-notice">{notice}</p>}{error && <p className="settings-error">{error}</p>}
  </section>;
}
