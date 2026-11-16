'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, Heart, ImagePlus, Save, X } from 'lucide-react';
import TimelineEditor from './TimelineEditor';
type Profile = { id: string; username: string; display_name: string; avatar_url: string | null };
type Data = { me: string; users: Profile[]; theme: string; wallpaper: string; wallpaper_image_url: string | null };
const themes = [
  { id: 'garden', name: 'Garden green', detail: 'Our leafy favourite' },
  { id: 'ocean', name: 'Ocean blue', detail: 'Peaceful blue tones' },
  { id: 'blossom', name: 'Soft blossom', detail: 'A warm, gentle touch' },
  { id: 'night', name: 'Quiet night', detail: 'A calm evening look' },
];
const wallpapers = [
  { id: 'garden', name: 'Leafy garden', detail: 'A little green and peaceful' },
  { id: 'sky', name: 'Cloud blue', detail: 'Soft sky, slow afternoons' },
  { id: 'petals', name: 'Petal notes', detail: 'Warm and softly textured' },
  { id: 'night', name: 'Starry evening', detail: 'A quiet night sky' },
];
export default function Settings({ me }: { me: { id: string; name: string } }) {
  const [data, setData] = useState<Data | null>(null);
  const [name, setName] = useState(me.name);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Profile | null>(null);
  const [wallpaperFile, setWallpaperFile] = useState<File | null>(null);
  const [wallpaperPreview, setWallpaperPreview] = useState<string | null>(null);
  useEffect(() => { fetch('/api/profile', { cache: 'no-store' }).then(r => r.json()).then(d => { if (!d.error) { setData(d); const own = d.users.find((u: Profile) => u.id === me.id); if (own) setName(own.display_name); } }).catch(() => setError('Could not load settings.')); }, [me.id]);
  useEffect(() => { if (!photo) { setPreview(null); return; } const url = URL.createObjectURL(photo); setPreview(url); return () => URL.revokeObjectURL(url); }, [photo]);
  useEffect(() => { if (!wallpaperFile) { setWallpaperPreview(null); return; } const url = URL.createObjectURL(wallpaperFile); setWallpaperPreview(url); return () => URL.revokeObjectURL(url); }, [wallpaperFile]);
  const own = data?.users.find(user => user.id === me.id);
  const friend = data?.users.find(user => user.id !== me.id);
  async function saveProfile(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      let profile_image_key: string | undefined;
      if (photo) {
        const ticketResponse = await fetch('/api/profile/avatar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: photo.type, size: photo.size }) });
        const ticket = await ticketResponse.json();
        if (!ticketResponse.ok) throw new Error(ticket.error);
        const upload = await fetch(ticket.uploadUrl, { method: 'PUT', headers: { 'Content-Type': ticket.type }, body: photo });
        if (!upload.ok) throw new Error('Photo upload failed. Check Neon Object Storage and try again.');
        profile_image_key = ticket.key;
      }
      const response = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ display_name: name, ...(profile_image_key ? { profile_image_key } : {}) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (result.profile && data) setData({ ...data, users: data.users.map(user => user.id === me.id ? result.profile : user) });
      setPhoto(null); setNotice('Your profile is saved.');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save profile.'); }
    finally { setBusy(false); }
  }
  async function saveWallpaper(wallpaper: string, wallpaper_image_key: string | null = null) {
    if (!data) return;
    const previous = data.wallpaper; setData({ ...data, wallpaper, wallpaper_image_url: wallpaperPreview ?? data.wallpaper_image_url }); setError(''); setNotice('');
    try {
      const response = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wallpaper, wallpaper_image_key }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setData(current => current ? { ...current, wallpaper: result.wallpaper, wallpaper_image_url: result.wallpaper_image_url } : current);
      setWallpaperFile(null);
      setNotice(`The shared wallpaper is now ${wallpaper === 'custom' ? 'your photo' : wallpapers.find(item => item.id === wallpaper)?.name}.`);
    } catch (reason) { setData(current => current ? { ...current, wallpaper: previous } : current); setError(reason instanceof Error ? reason.message : 'Could not update wallpaper.'); }
  }
  async function saveTheme(theme: string) {
    if (!data) return;
    const previous = data.theme;
    setData(current => current ? { ...current, theme } : current); setError(''); setNotice('');
    try {
      const response = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ theme }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setData(current => current ? { ...current, theme: result.theme } : current);
      setNotice(`The shared chat colours are now ${themes.find(item => item.id === theme)?.name}.`);
    } catch (reason) { setData(current => current ? { ...current, theme: previous } : current); setError(reason instanceof Error ? reason.message : 'Could not update chat colours.'); }
  }
  async function uploadWallpaper() {
    if (!wallpaperFile) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const ticketResponse = await fetch('/api/profile/wallpaper', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: wallpaperFile.type, size: wallpaperFile.size }) });
      const ticket = await ticketResponse.json();
      if (!ticketResponse.ok) throw new Error(ticket.error);
      const upload = await fetch(ticket.uploadUrl, { method: 'PUT', headers: { 'Content-Type': ticket.type }, body: wallpaperFile });
      if (!upload.ok) throw new Error('Wallpaper upload failed. Check Neon Object Storage and try again.');
      await saveWallpaper('custom', ticket.key);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not upload wallpaper.'); }
    finally { setBusy(false); }
  }
  function profilePhoto(profile: Profile | undefined, fallback: string, chosen = false) {
    const src = chosen && preview ? preview : profile?.avatar_url;
    return <button type="button" className="settings-avatar" onClick={() => profile && src && setExpanded(profile)} aria-label={profile ? `View ${profile.display_name}'s profile photo` : 'Profile photo'}>{src ? <img src={src} alt={profile?.display_name ?? fallback}/> : <span>{fallback.slice(0, 1)}</span>}</button>;
  }
  return <main className="settings-page">
    <header className="settings-header"><Link href="/chat" className="chat-back" aria-label="Back to chat"><ArrowLeft size={19}/></Link><div><strong>Our little settings</strong><span>Make this space feel like us</span></div><span className="settings-heart"><Heart size={17} fill="currentColor"/></span></header>
    <div className="settings-content">
      <section className="settings-section"><div className="settings-section-heading"><div className="settings-icon"><Heart size={17}/></div><div><h1>Our profiles</h1><p>A little introduction to the two people in this corner.</p></div></div>
        <div className="settings-profiles">{[own, friend].filter(Boolean).map(profile => <article className={`settings-profile ${profile!.id === me.id ? 'editable' : ''}`} key={profile!.id}>{profilePhoto(profile, profile!.display_name, profile!.id === me.id && Boolean(photo))}<div className="settings-profile-copy"><strong>{profile!.display_name}</strong><span>{profile!.id === me.id ? 'Your profile' : 'Your favourite person'} · @{profile!.username}</span></div>{profile!.id === me.id && <label className="photo-change" title="Choose a profile photo"><ImagePlus size={17}/><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={event => setPhoto(event.target.files?.[0] ?? null)}/></label>}</article>)}</div>
        <form className="profile-form" onSubmit={saveProfile}><label htmlFor="display-name">Your name</label><input id="display-name" value={name} maxLength={80} onChange={event => setName(event.target.value)} required/><p className="settings-hint">Profile photo: JPEG, PNG, WebP, or GIF up to 8 MB.</p><button className="button button-green" disabled={busy}><Save size={15}/>{busy ? 'Saving…' : 'Save profile'}</button></form>
      </section>
      <section className="settings-section"><div className="settings-section-heading"><div className="settings-icon"><Heart size={17}/></div><div><h2>Chat colour theme</h2><p>Choose the shared colours for our chat. This is separate from the wallpaper.</p></div></div><div className="theme-options">{themes.map(item => <button type="button" key={item.id} className={`theme-option ${data?.theme === item.id ? 'active' : ''}`} onClick={() => saveTheme(item.id)} aria-pressed={data?.theme === item.id}><span className={`theme-preview preview-${item.id}`}><i/><i/><i/></span><span className="theme-name"><strong>{item.name}</strong><small>{item.detail}</small></span>{data?.theme === item.id && <Check size={16} className="theme-check"/>}</button>)}</div></section>
      <TimelineEditor />
      <section className="settings-section wallpaper-settings"><div className="settings-section-heading"><div className="settings-icon"><ImagePlus size={17}/></div><div><h2>Our shared chat wallpaper</h2><p>Pick a background image for the conversation. It stretches to fill the chat area.</p></div></div><div className="wallpaper-options">{wallpapers.map(item => <button type="button" key={item.id} className={`wallpaper-option ${data?.wallpaper === item.id ? 'active' : ''}`} onClick={() => saveWallpaper(item.id)} aria-pressed={data?.wallpaper === item.id}><span className={`wallpaper-preview wallpaper-swatch-${item.id}`}><i/><i/><i/></span><span className="wallpaper-name"><strong>{item.name}</strong><small>{item.detail}</small></span>{data?.wallpaper === item.id && <Check size={16} className="wallpaper-check"/>}</button>)}</div><div className="custom-wallpaper-row"><div><strong>Use one of your photos</strong><span>JPEG, PNG, or WebP · up to 10 MB</span></div><label className="photo-change" title="Choose a chat wallpaper"><ImagePlus size={17}/><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setWallpaperFile(event.target.files?.[0] ?? null)}/></label></div>{wallpaperFile && wallpaperPreview && <div className="custom-wallpaper-preview" style={{ backgroundImage: `url("${wallpaperPreview}")` }}><span>Preview</span><button className="button button-green" type="button" onClick={uploadWallpaper} disabled={busy}>{busy ? 'Saving…' : 'Use this wallpaper'}</button><button className="wallpaper-cancel" type="button" aria-label="Cancel wallpaper selection" onClick={() => setWallpaperFile(null)}><X size={16}/></button></div>}</section>
      {notice && <p className="settings-notice"><Check size={15}/>{notice}</p>}{error && <p className="settings-error"><X size={15}/>{error}</p>}
      <Link href="/chat" className="settings-back-chat">Back to our chat <ArrowLeft size={15}/></Link>
    </div>
    {expanded && <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label={`${expanded.display_name} profile photo`} onClick={() => setExpanded(null)}><button type="button" aria-label="Close photo"><X size={20}/></button><img src={expanded.avatar_url ?? undefined} alt={expanded.display_name}/><strong>{expanded.display_name}</strong></div>}
  </main>;
}
