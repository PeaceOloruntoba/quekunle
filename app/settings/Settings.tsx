'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Bell, Check, Heart, ImagePlus, Save, Smartphone, X } from 'lucide-react';
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
const notificationOptions = [
  ['messages', 'New messages', 'Messages, photos, videos, documents, and voice notes'],
  ['timeline', 'Timeline updates', 'Added, edited, or removed moments'],
  ['memories', 'Memory updates', 'New memories, notes, and gallery changes'],
  ['profile', 'Profile updates', 'Display name and profile photo changes'],
  ['wallpaper', 'Chat appearance', 'Shared wallpaper and colour changes'],
  ['receipts', 'Read receipts', 'When your messages are read'],
] as const;
type PushPreferences = Record<(typeof notificationOptions)[number][0], boolean>;
const defaultPushPreferences: PushPreferences = { messages: true, timeline: true, memories: true, profile: true, wallpaper: true, receipts: true };
function decodeVapidKey(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const raw = atob(padded);
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}
function isIOSDevice() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); }
export default function Settings({ me }: { me: { id: string; name: string } }) {
  const [data, setData] = useState<Data | null>(null);
  const [name, setName] = useState(me.name);
  const [friendName, setFriendName] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<Profile | null>(null);
  const [wallpaperFile, setWallpaperFile] = useState<File | null>(null);
  const [wallpaperPreview, setWallpaperPreview] = useState<string | null>(null);
  const [pushPublicKey, setPushPublicKey] = useState<string | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushPreferences, setPushPreferences] = useState<PushPreferences>(defaultPushPreferences);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushNotice, setPushNotice] = useState('');
  const [pushError, setPushError] = useState('');
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [iosInstall, setIosInstall] = useState(false);
  useEffect(() => { fetch('/api/profile', { cache: 'no-store' }).then(r => r.json()).then(d => { if (!d.error) { setData(d); const own = d.users.find((u: Profile) => u.id === me.id); const friend = d.users.find((u: Profile) => u.id !== me.id); if (own) setName(own.display_name); if (friend) setFriendName(friend.display_name); } }).catch(() => setError('Could not load settings.')); }, [me.id]);
  useEffect(() => {
    const capturePrompt = () => setInstallPrompt((window as any).__twofoldsInstallPrompt ?? null);
    capturePrompt();
    window.addEventListener('quekunle-install-available', capturePrompt);
    window.addEventListener('quekunle-app-installed', capturePrompt);
    setIosInstall(isIOSDevice());
    void (async () => {
      try {
        let endpoint = '';
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          endpoint = (await registration.pushManager.getSubscription())?.endpoint ?? '';
        }
        const response = await fetch(`/api/push/subscribe?endpoint=${encodeURIComponent(endpoint)}`, { cache: 'no-store' });
        const result = await response.json();
        setPushPublicKey(result.publicKey); setPushEnabled(Boolean(result.enabled)); setPushPreferences({ ...defaultPushPreferences, ...(result.preferences ?? {}) });
      } catch { setPushError('Could not load notification settings.'); }
    })();
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => setPushError('Could not register notifications on this browser.'));
    return () => { window.removeEventListener('quekunle-install-available', capturePrompt); window.removeEventListener('quekunle-app-installed', capturePrompt); };
  }, []);
  useEffect(() => { if (!photo) { setPreview(null); return; } const url = URL.createObjectURL(photo); setPreview(url); return () => URL.revokeObjectURL(url); }, [photo]);
  useEffect(() => { if (!wallpaperFile) { setWallpaperPreview(null); return; } const url = URL.createObjectURL(wallpaperFile); setWallpaperPreview(url); return () => URL.revokeObjectURL(url); }, [wallpaperFile]);
  const own = data?.users.find(user => user.id === me.id);
  const friend = data?.users.find(user => user.id !== me.id);
  async function enablePush() {
    setPushBusy(true); setPushError(''); setPushNotice('');
    try {
      const isIOS = isIOSDevice() && !(window as any).MSStream;
      const isInstalled = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as any).standalone);
      if (isIOS && !isInstalled) throw new Error('On iPhone or iPad, install Quekunle from Safari’s Share menu first, then enable push from the home screen app.');
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) throw new Error('This browser does not support web push notifications. Try installing Quekunle in a current browser.');
      if (!pushPublicKey) throw new Error('Web push is not configured yet. Add the VAPID keys on the server and redeploy.');
      const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (permission !== 'granted') throw new Error(permission === 'denied' ? 'Notifications are blocked in browser settings. Allow them there, then try again.' : 'Notification permission was not granted.');
      const registration = await navigator.serviceWorker.register('/sw.js');
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeVapidKey(pushPublicKey) as BufferSource });
      const response = await fetch('/api/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: subscription.toJSON(), preferences: pushPreferences }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not enable push notifications.');
      setPushEnabled(true); setPushNotice('Notifications are on for this device.');
    } catch (reason) { setPushError(reason instanceof Error ? reason.message : 'Could not enable notifications.'); }
    finally { setPushBusy(false); }
  }
  async function disablePush() {
    setPushBusy(true); setPushError(''); setPushNotice('');
    try {
      const registration = await navigator.serviceWorker?.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/push/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
        await subscription.unsubscribe();
      }
      setPushEnabled(false); setPushNotice('Notifications are off for this device.');
    } catch { setPushError('Could not turn notifications off. Please try again.'); }
    finally { setPushBusy(false); }
  }
  async function savePushPreferences(next: PushPreferences) {
    setPushPreferences(next);
    if (!pushEnabled) return;
    try { const response = await fetch('/api/push/subscribe', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preferences: next }) }); if (!response.ok) setPushError('Could not save notification choices.'); }
    catch { setPushError('Could not save notification choices.'); }
  }
  async function installApp() {
    if (!installPrompt) { setShowInstallGuide(true); return; }
    await installPrompt.prompt();
    await installPrompt.userChoice;
    (window as any).__twofoldsInstallPrompt = undefined;
    setInstallPrompt(null);
  }
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
      const response = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile_user_id: me.id, display_name: name, ...(profile_image_key ? { profile_image_key } : {}) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (result.profile) setData(current => current ? { ...current, users: current.users.map(user => user.id === me.id ? result.profile : user) } : current);
      if (friend && friendName.trim() !== friend.display_name) {
        const friendResponse = await fetch('/api/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile_user_id: friend.id, display_name: friendName }) });
        const friendResult = await friendResponse.json();
        if (!friendResponse.ok) throw new Error(friendResult.error);
        if (friendResult.profile) setData(current => current ? { ...current, users: current.users.map(user => user.id === friend.id ? friendResult.profile : user) } : current);
      }
      setPhoto(null); setNotice('Profile details saved.');
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
        <div className="settings-profiles">{[own, friend].filter(Boolean).map(profile => <article className={`settings-profile ${profile!.id === me.id ? 'editable' : ''}`} key={profile!.id}>{profilePhoto(profile, profile!.display_name, profile!.id === me.id && Boolean(photo))}<div className="settings-profile-copy"><strong>{profile!.display_name}</strong><span>{profile!.id === me.id ? 'Your profile' : 'Your favourite person'} · @{profile!.username}</span></div>{profile!.id === me.id && <label className="photo-change" title="Choose a profile photo"><ImagePlus size={17}/><input type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif" onChange={event => setPhoto(event.target.files?.[0] ?? null)}/></label>}</article>)}</div>
        <form className="profile-form" onSubmit={saveProfile}><label htmlFor="display-name">Your display name</label><input id="display-name" value={name} maxLength={80} onChange={event => setName(event.target.value)} required/><label htmlFor="friend-display-name">{friend?.display_name ?? 'Their display name'}</label><input id="friend-display-name" value={friendName} maxLength={80} onChange={event => setFriendName(event.target.value)} required/><p className="settings-hint">You can update either display name here. Usernames stay the same. Profile photos: JPEG, PNG, WebP, GIF, or HEIC up to 8 MB.</p><button className="button button-green" disabled={busy}><Save size={15}/>{busy ? 'Saving…' : 'Save profile details'}</button></form>
      </section>
      <section className="settings-section"><div className="settings-section-heading"><div className="settings-icon"><Heart size={17}/></div><div><h2>Chat colour theme</h2><p>Choose the shared colours for our chat. This is separate from the wallpaper.</p></div></div><div className="theme-options">{themes.map(item => <button type="button" key={item.id} className={`theme-option ${data?.theme === item.id ? 'active' : ''}`} onClick={() => saveTheme(item.id)} aria-pressed={data?.theme === item.id}><span className={`theme-preview preview-${item.id}`}><i/><i/><i/></span><span className="theme-name"><strong>{item.name}</strong><small>{item.detail}</small></span>{data?.theme === item.id && <Check size={16} className="theme-check"/>}</button>)}</div></section>
      <TimelineEditor />
      <section className="settings-section notification-settings"><div className="settings-section-heading"><div className="settings-icon"><Bell size={17}/></div><div><h2>Notifications on your device</h2><p>Get a gentle nudge for the moments you might miss. You can change these any time.</p></div></div>
        <div className="notification-master"><div><strong>Push notifications</strong><span>{pushEnabled ? 'Enabled on this device' : 'Currently turned off'}</span></div><button type="button" className="button button-green" disabled={pushBusy} onClick={pushEnabled ? disablePush : enablePush}>{pushBusy ? 'Updating…' : pushEnabled ? 'Turn off' : 'Turn on'}</button></div>
        <div className="notification-options">{notificationOptions.map(([key, title, detail]) => <label className="notification-option" key={key}><span><strong>{title}</strong><small>{detail}</small></span><input type="checkbox" checked={pushPreferences[key]} disabled={!pushEnabled || pushBusy} onChange={event => { const next = { ...pushPreferences, [key]: event.target.checked }; void savePushPreferences(next); }}/></label>)}</div>
        <div className="notification-install"><div className="settings-icon"><Smartphone size={17}/></div><span><strong>Add Quekunle to your home screen</strong><small>Open it like an app and keep your little world close.</small></span><button type="button" className="button button-soft" onClick={installApp}>{installPrompt ? 'Install' : 'How to install'}</button></div>
        {pushNotice && <p className="settings-notice"><Check size={15}/>{pushNotice}</p>}{pushError && <p className="settings-error"><X size={15}/>{pushError}</p>}
      </section>
      <section className="settings-section wallpaper-settings"><div className="settings-section-heading"><div className="settings-icon"><ImagePlus size={17}/></div><div><h2>Our shared chat wallpaper</h2><p>Pick a background image for the conversation. It covers the chat while keeping its proportions.</p></div></div><div className="wallpaper-options">{wallpapers.map(item => <button type="button" key={item.id} className={`wallpaper-option ${data?.wallpaper === item.id ? 'active' : ''}`} onClick={() => saveWallpaper(item.id)} aria-pressed={data?.wallpaper === item.id}><span className={`wallpaper-preview wallpaper-swatch-${item.id}`}><i/><i/><i/></span><span className="wallpaper-name"><strong>{item.name}</strong><small>{item.detail}</small></span>{data?.wallpaper === item.id && <Check size={16} className="wallpaper-check"/>}</button>)}</div><div className="custom-wallpaper-row"><div><strong>Use one of your photos</strong><span>JPEG, PNG, WebP, or HEIC · up to 10 MB</span></div><label className="photo-change" title="Choose a chat wallpaper"><ImagePlus size={17}/><input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={event => setWallpaperFile(event.target.files?.[0] ?? null)}/></label></div>{wallpaperFile && wallpaperPreview && <div className="custom-wallpaper-preview" style={{ backgroundImage: `url("${wallpaperPreview}")` }}><span>Preview</span><button className="button button-green" type="button" onClick={uploadWallpaper} disabled={busy}>{busy ? 'Saving…' : 'Use this wallpaper'}</button><button className="wallpaper-cancel" type="button" aria-label="Cancel wallpaper selection" onClick={() => setWallpaperFile(null)}><X size={16}/></button></div>}</section>
      {notice && <p className="settings-notice"><Check size={15}/>{notice}</p>}{error && <p className="settings-error"><X size={15}/>{error}</p>}
      <Link href="/chat" className="settings-back-chat">Back to our chat <ArrowLeft size={15}/></Link>
    </div>
    {expanded && <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label={`${expanded.display_name} profile photo`} onClick={() => setExpanded(null)}><button type="button" aria-label="Close photo"><X size={20}/></button><img src={expanded.avatar_url ?? undefined} alt={expanded.display_name}/><strong>{expanded.display_name}</strong></div>}
    {showInstallGuide && <div className="photo-lightbox install-guide" role="dialog" aria-modal="true" aria-label="Install Quekunle" onClick={() => setShowInstallGuide(false)}><article onClick={event => event.stopPropagation()}><button type="button" aria-label="Close install guide" onClick={() => setShowInstallGuide(false)}><X size={20}/></button><div className="settings-icon"><Smartphone size={20}/></div><h2>Add Quekunle to your home screen</h2><p>{iosInstall ? 'In Safari, tap the Share button, then choose “Add to Home Screen”. Web push on iPhone and iPad works from the installed home screen app.' : 'Open your browser menu and choose “Install app” or “Add to Home screen”. On supported browsers, you can also use the Install button in the browser address bar.'}</p></article></div>}
  </main>;
}
