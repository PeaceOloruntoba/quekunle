'use client';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, CheckCheck, Download, FileText, LogOut, Mic, Paperclip, Pause, Play, Reply, Send, Smile, SmilePlus, Square, X, Settings } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ProfilePhoto from '../ProfilePhoto';

type Reaction = { emoji: string; user_id: string };
type Message = {
  id: number;
  sender_id: string;
  sender_name: string;
  body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  attachment_type: string | null;
  reply_to_id: number | null;
  reply_body: string | null;
  reply_sender_name: string | null;
  reactions: Reaction[];
  created_at: string;
  read_at: string | null;
};
const emojis = ['❤️', '🥰', '😂', '😊', '😍', '💕', '✨', '🌿', '🤗', '🥹', '💙', '👍'];
const waveBars = [7, 14, 10, 20, 12, 25, 16, 9, 21, 13, 27, 17, 11, 23, 14, 8, 19, 26, 12, 18, 9, 24, 15, 21, 10, 17, 27, 13, 8, 20, 14, 23, 11, 18, 7, 15];
function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const rest = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}
function VoiceNotePlayer({ src }: { src: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const progress = duration ? position / duration : 0;
  async function togglePlayback() {
    if (!audio.current) return;
    if (audio.current.paused) { try { await audio.current.play(); } catch { setPlaying(false); } }
    else audio.current.pause();
  }
  function seek(event: React.MouseEvent<HTMLButtonElement>) {
    if (!audio.current || !duration) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    audio.current.currentTime = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)) * duration;
  }
  return <div className="voice-note-player">
    <audio ref={audio} src={src} preload="metadata" onLoadedMetadata={event => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)} onTimeUpdate={event => setPosition(event.currentTarget.currentTime)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); setPosition(0); }}/>
    <button type="button" className="voice-play" onClick={togglePlayback} aria-label={playing ? 'Pause voice note' : 'Play voice note'}>{playing ? <Pause size={17} fill="currentColor"/> : <Play size={17} fill="currentColor"/>}</button>
    <div className="voice-player-track">
      <button type="button" className="voice-waveform" onClick={seek} aria-label="Seek through voice note">
        {waveBars.map((height, index) => <span key={index} style={{ height, opacity: index / waveBars.length <= progress ? 1 : 0.38 }}/>)}
      </button>
      <div className="voice-player-caption"><span>VOICE NOTE</span><time>{formatDuration(playing ? position : duration)}</time></div>
    </div>
  </div>;
}

export default function Chat({ me, other, initialTheme, initialWallpaper, initialWallpaperUrl }: { me: { id: string; name: string }; other: { name: string; avatarUrl: string }; initialTheme: string; initialWallpaper: string; initialWallpaperUrl: string | null }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [wallpaper, setWallpaper] = useState(initialWallpaper);
  const [wallpaperImage, setWallpaperImage] = useState<string | null>(initialWallpaperUrl);
  const [theme, setTheme] = useState(initialTheme);
  const [otherName, setOtherName] = useState(other.name);
  const [otherAvatarUrl, setOtherAvatarUrl] = useState(other.avatarUrl);
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [reactingTo, setReactingTo] = useState<number | null>(null);
  const [activeMessageActions, setActiveMessageActions] = useState<number | null>(null);
  const [expandedMedia, setExpandedMedia] = useState<{ url: string; type: string; name: string } | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const recordingStartedAt = useRef(0);
  const discardRecording = useRef(false);
  const socket = useRef<WebSocket | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressOrigin = useRef<{ x: number; y: number } | null>(null);
  const suppressLongPressClick = useRef(false);
  const router = useRouter();

  function cancelMessageLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    longPressOrigin.current = null;
  }
  function startMessageLongPress(id: number, event: React.TouchEvent<HTMLElement>) {
    cancelMessageLongPress();
    const touch = event.touches[0];
    longPressOrigin.current = { x: touch.clientX, y: touch.clientY };
    suppressLongPressClick.current = false;
    longPressTimer.current = setTimeout(() => {
      suppressLongPressClick.current = true;
      setTimeout(() => { suppressLongPressClick.current = false; }, 800);
      setActiveMessageActions(id);
    }, 2000);
  }
  function moveMessageLongPress(event: React.TouchEvent<HTMLElement>) {
    const touch = event.touches[0];
    const origin = longPressOrigin.current;
    if (touch && origin && (Math.abs(touch.clientX - origin.x) > 12 || Math.abs(touch.clientY - origin.y) > 12)) cancelMessageLongPress();
  }

  const mergeMessage = useCallback((incoming: Message) => {
    setMessages(previous => {
      const merged = new Map<number, Message>();
      previous.forEach(message => merged.set(message.id, message));
      const old = merged.get(incoming.id);
      merged.set(incoming.id, { ...old, ...incoming, read_at: incoming.read_at ?? old?.read_at ?? null });
      return Array.from(merged.values()).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/messages', { cache: 'no-store' });
      if (response.status === 401) { router.push('/login'); return; }
      const data = await response.json();
      for (const message of data.messages as Message[]) mergeMessage(message);
    } catch { /* A later WebSocket reconnect will rehydrate message history. */ }
  }, [mergeMessage, router]);

  useEffect(() => {
    let stopped = false;
    let delay = 1000;
    let retry: ReturnType<typeof setTimeout>;
    const queueReconnect = () => {
      if (stopped) return;
      retry = setTimeout(connect, delay);
      delay = Math.min(delay * 2, 20000);
    };
    const connect = () => {
      if (stopped) return;
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      if (typeof WebSocket === 'undefined') { queueReconnect(); return; }
      let ws: WebSocket;
      try { ws = new WebSocket(`${protocol}//${location.host}/api/ws`); }
      catch { queueReconnect(); return; }
      socket.current = ws;
      ws.onopen = () => { delay = 1000; void load(); };
      ws.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'message' && data.message) mergeMessage(data.message as Message);
          if (data.type === 'profile' && data.user_id === other.id) { setOtherName(data.display_name); setOtherAvatarUrl(data.avatar_url ?? ''); }
          if (data.type === 'wallpaper' && typeof data.wallpaper === 'string') { setWallpaper(data.wallpaper); setWallpaperImage(data.wallpaper_image_url ?? null); if (data.theme) setTheme(data.theme); }
          if (data.type === 'read' && Array.isArray(data.ids)) {
            const ids = new Set<number>(data.ids);
            setMessages(previous => previous.map(message => ids.has(message.id) ? { ...message, read_at: data.read_at } : message));
          }
          if (data.type === 'reaction') {
            const { message_id, user_id, emoji, active } = data as { message_id: number; user_id: string; emoji: string; active: boolean };
            setMessages(previous => previous.map(message => {
              if (message.id !== message_id) return message;
              const reactions = message.reactions.filter(reaction => !(reaction.user_id === user_id && reaction.emoji === emoji));
              if (active) reactions.push({ user_id, emoji });
              return { ...message, reactions };
            }));
          }
        } catch { /* Ignore malformed frames and keep the connection alive. */ }
      };
      ws.onclose = () => {
        if (stopped) return;
        queueReconnect();
      };
      ws.onerror = () => ws.close();
    };
    const fallback = window.setInterval(() => { if (socket.current?.readyState !== 1) void load(); }, 30000);
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    void load();
    connect();
    return () => { stopped = true; clearTimeout(retry); clearInterval(fallback); document.removeEventListener('visibilitychange', onVisibilityChange); socket.current?.close(); socket.current = null; };
  }, [load, mergeMessage, other.id]);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setRecordingSeconds(Math.floor((Date.now() - recordingStartedAt.current) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (!file?.type.startsWith('audio/')) { setAudioPreviewUrl(null); return; }
    const url = URL.createObjectURL(file);
    setAudioPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' }); }, [messages]);

  async function upload(selected: File) {
    const response = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: selected.name, type: selected.type, size: selected.size }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    const uploaded = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': data.type }, body: selected });
    if (!uploaded.ok) throw new Error('The file could not be uploaded. Check Neon Object Storage access and try again.');
    return { key: data.key, name: data.name, type: data.type };
  }

  async function send(event?: React.FormEvent) {
    event?.preventDefault();
    if ((!body.trim() && !file) || sending) return;
    setSending(true); setError('');
    try {
      const attachment = file ? await upload(file) : undefined;
      const response = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body, attachment, reply_to_id: replyingTo?.id ?? null }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (data.message) mergeMessage(data.message as Message);
      setBody(''); setFile(null); setReplyingTo(null);
      if (input.current) input.current.value = '';
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not send.'); }
    finally { setSending(false); }
  }

  async function react(messageId: number, emoji: string) {
    setReactingTo(null);
    setActiveMessageActions(null);
    try {
      const response = await fetch(`/api/messages/${messageId}/reactions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMessages(previous => previous.map(message => {
        if (message.id !== messageId) return message;
        const reactions = message.reactions.filter(reaction => !(reaction.user_id === data.user_id && reaction.emoji === data.emoji));
        if (data.active) reactions.push({ user_id: data.user_id, emoji: data.emoji });
        return { ...message, reactions };
      }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save that reaction.'); }
  }

  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); router.push('/'); router.refresh(); }

  async function record() {
    if (recording) { recorder.current?.stop(); return; }
    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === 'undefined') {
      setError('Voice recording is not available in this browser. Please update Safari or use a supported browser.');
      return;
    }
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const Recorder = window.MediaRecorder;
      const preferred = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/ogg;codecs=opus'].find(type => typeof Recorder.isTypeSupported === 'function' && Recorder.isTypeSupported(type));
      const mediaRecorder = preferred ? new Recorder(stream, { mimeType: preferred }) : new Recorder(stream);
      recorder.current = mediaRecorder; chunks.current = []; discardRecording.current = false;
      mediaRecorder.ondataavailable = event => { if (event.data.size) chunks.current.push(event.data); };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        if (!discardRecording.current) {
          const type = mediaRecorder.mimeType || 'audio/webm';
          const extension = type.split(';')[0].split('/')[1]?.replace('3gpp', '3gp') || 'webm';
          const voice = new File(chunks.current, `voice-note-${Date.now()}.${extension}`, { type });
          if (voice.size) setFile(voice);
          else setError('That recording was empty. Try recording your note again.');
        }
        discardRecording.current = false; setRecording(false); setRecordingSeconds(0);
      };
      mediaRecorder.start(); recordingStartedAt.current = Date.now(); setRecordingSeconds(0); setFile(null); setError(''); setRecording(true);
    } catch (reason) {
      stream?.getTracks().forEach(track => track.stop());
      setError(reason instanceof Error && reason.name === 'NotAllowedError' ? 'Allow microphone access in Safari Settings to record a voice note.' : 'Could not start voice recording. Check microphone access and try again.');
    }
  }

  function cancelRecording() {
    discardRecording.current = true;
    if (recorder.current && recorder.current.state !== 'inactive') recorder.current.stop();
    else { setRecording(false); setRecordingSeconds(0); }
  }

  function time(value: string) { return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }); }
  function localDayKey(value: string) {
    const date = new Date(value);
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }
  function dateGroup(value: string) {
    const date = new Date(value);
    const today = new Date();
    const currentDay = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
    const messageDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
    const daysAgo = Math.floor((currentDay - messageDay) / 86_400_000);
    if (daysAgo <= 0) return 'Today';
    if (daysAgo === 1) return 'Yesterday';
    if (daysAgo < 7) return date.toLocaleDateString([], { weekday: 'long' });
    return date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function replyText(message: Message) {
    if (message.body) return message.body;
    if (message.attachment_type?.startsWith('image/')) return 'Photo';
    if (message.attachment_type?.startsWith('video/')) return 'Video';
    if (message.attachment_type?.startsWith('audio/')) return 'Voice note';
    return message.attachment_name || 'Attachment';
  }
  useEffect(() => {
    if (!expandedMedia) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setExpandedMedia(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [expandedMedia]);

  return <main className={`chat-page theme-${theme} wallpaper-${wallpaper}`} style={wallpaper === 'custom' && wallpaperImage ? { ['--chat-wallpaper-image' as string]: `url("${wallpaperImage}")` } as React.CSSProperties : undefined}>
    <header className="chat-header">
      <Link href="/" className="chat-back" aria-label="Home"><ArrowLeft size={19}/></Link>
      {otherAvatarUrl && <ProfilePhoto src={otherAvatarUrl} name={otherName} className="chat-avatar" badge="✿" imageClassName="chat-avatar-image"/>}
      <div className="chat-title"><strong>{otherName}</strong><span><i/> Just us, always</span></div>
      <div className="chat-header-actions"><Link href="/settings" className="chat-action" title="Settings" aria-label="Settings"><Settings size={17}/></Link><button className="chat-logout" onClick={logout} title="Log out"><LogOut size={17}/></button></div>
    </header>
    <div className="chat-wallpaper">
      <div className="message-list" ref={list}>
        {messages.map((message, index) => {
          const mine = message.sender_id === me.id;
          const dayChanged = index === 0 || localDayKey(messages[index - 1].created_at) !== localDayKey(message.created_at);
          const groups = Array.from(new Set(message.reactions.map(reaction => reaction.emoji)));
          return <Fragment key={message.id}>{dayChanged && <div className="day-separator"><span>{dateGroup(message.created_at)}</span></div>}<article className={`message ${mine ? 'mine' : 'theirs'} ${activeMessageActions === message.id ? 'actions-open' : ''}`} onTouchStart={event => startMessageLongPress(message.id, event)} onTouchEnd={cancelMessageLongPress} onTouchCancel={cancelMessageLongPress} onTouchMove={moveMessageLongPress} onContextMenu={event => { event.preventDefault(); if (!('ontouchstart' in window)) setActiveMessageActions(message.id); }} onClick={event => { if (suppressLongPressClick.current) { event.preventDefault(); suppressLongPressClick.current = false; return; } if (!(event.target as HTMLElement).closest('.message-tools,.message-reaction-picker')) setActiveMessageActions(null); }}>
            <div className="message-bubble">
              {message.reply_to_id && <div className="reply-preview"><strong>{message.reply_sender_name || 'A message'}</strong><span>{message.reply_body || 'Attachment'}</span></div>}
              {message.attachment_url && <div className="attachment">
                {message.attachment_type?.startsWith('image/') ? <button type="button" className="attachment-image-trigger" onClick={() => setExpandedMedia({ url: message.attachment_url!, type: 'image', name: message.attachment_name || 'Shared image' })} aria-label="Open image"><img src={message.attachment_url} alt={message.attachment_name || 'Shared image'} loading="lazy"/></button>
                  : message.attachment_type?.startsWith('video/') ? <button type="button" className="attachment-video-trigger" onClick={() => setExpandedMedia({ url: message.attachment_url!, type: 'video', name: message.attachment_name || 'Shared video' })} aria-label="Open video"><video src={message.attachment_url} muted playsInline preload="metadata"/><span><Play size={22} fill="currentColor"/></span></button>
                    : message.attachment_type?.startsWith('audio/') ? <VoiceNotePlayer src={message.attachment_url}/>
                      : <a className="file-link" href={message.attachment_url} target="_blank" rel="noreferrer"><FileText size={19}/>{message.attachment_name}</a>}
              </div>}
              {message.body && <p>{message.body}</p>}
              {groups.length > 0 && <div className="reaction-chips">{groups.map(emoji => {
                const selected = message.reactions.some(reaction => reaction.emoji === emoji && reaction.user_id === me.id);
                const count = message.reactions.filter(reaction => reaction.emoji === emoji).length;
                return <button key={emoji} className={`reaction-chip ${selected ? 'selected' : ''}`} onClick={() => react(message.id, emoji)} aria-label={`${count} ${emoji} reactions`}>{emoji}<span>{count}</span></button>;
              })}</div>}
              <div className="message-meta"><time>{time(message.created_at)}</time>{mine && (message.read_at ? <CheckCheck size={15} className="read-check"/> : <Check size={15}/>)}</div>
            </div>
            <div className="message-tools" role="group" aria-label="Message actions">
              <button onClick={() => { setReplyingTo(message); setReactingTo(null); setActiveMessageActions(null); }} title="Reply to this message" aria-label="Reply"><Reply size={15}/></button>
              <button onClick={() => { setReactingTo(reactingTo === message.id ? null : message.id); setActiveMessageActions(null); }} title="React to this message" aria-label="React"><SmilePlus size={15}/></button>
            </div>
            {reactingTo === message.id && <div className="message-reaction-picker">{emojis.map(emoji => <button key={emoji} onClick={() => react(message.id, emoji)} aria-label={`React ${emoji}`}>{emoji}</button>)}</div>}
          </article></Fragment>;
        })}
        {messages.length === 0 && <div className="empty-chat"><span>🌿</span><strong>Your little world is waiting.</strong><p>Say hi and make the first memory.</p></div>}
      </div>
    </div>
    <div className="composer-wrap">
      {error && <div className="chat-error">{error}<button onClick={() => setError('')}><X size={14}/></button></div>}
      {replyingTo && <div className="replying-banner"><div><strong>Replying to {replyingTo.sender_name}</strong><span>{replyText(replyingTo)}</span></div><button onClick={() => setReplyingTo(null)} aria-label="Cancel reply"><X size={16}/></button></div>}
      {recording && <div className="recording-banner"><span className="recording-indicator"/><div className="recording-copy"><strong>Recording voice note</strong><span>Speak naturally · {formatDuration(recordingSeconds)}</span></div><div className="recording-wave" aria-hidden="true">{waveBars.slice(0, 12).map((height, index) => <span key={index} style={{ height: Math.max(6, height * 0.72), animationDelay: `${index * 45}ms` }}/>)}</div><button type="button" className="recording-cancel" onClick={cancelRecording}>Cancel</button><button type="button" className="recording-stop" onClick={record} aria-label="Stop recording"><Square size={13} fill="currentColor"/></button></div>}
      {file?.type.startsWith('audio/') && audioPreviewUrl && <div className="voice-draft"><div className="voice-draft-heading"><div><strong>Voice note ready</strong><span>Listen before sending</span></div><button type="button" onClick={() => setFile(null)} aria-label="Remove voice note"><X size={16}/></button></div><VoiceNotePlayer src={audioPreviewUrl}/></div>}
      {file && !file.type.startsWith('audio/') && <div className="file-chip"><Paperclip size={14}/>{file.name}<button type="button" onClick={() => setFile(null)} aria-label="Remove attachment"><X size={15}/></button></div>}
      {emojiOpen && <div className="emoji-picker">{emojis.map(emoji => <button key={emoji} onClick={() => setBody(value => value + emoji)}>{emoji}</button>)}</div>}
      <form className="composer" onSubmit={send}>
        <button type="button" className="tool-button" onClick={() => setEmojiOpen(!emojiOpen)} aria-label="Choose emoji"><Smile size={21}/></button>
        <label className="tool-button attach-button" aria-label="Attach a file"><Paperclip size={21}/><input ref={input} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.csv" onChange={event => setFile(event.target.files?.[0] || null)}/></label>
        <input className="message-input" value={body} onChange={event => setBody(event.target.value)} placeholder="Write something sweet…" aria-label="Message"/>
        <button type="button" className={`tool-button mic-button ${recording ? 'recording' : ''}`} onClick={record} aria-label={recording ? 'Stop recording' : 'Record voice note'}>{recording ? <Square size={18} fill="currentColor"/> : <Mic size={21}/>}</button>
        <button className="send-button" disabled={sending || recording || (!body.trim() && !file)} aria-label="Send message">{sending ? <span className="sending-dot"/> : <Send size={18}/>}</button>
      </form>
      <div className="composer-note">Hold a message for 2 seconds to reply or react <span>♥</span></div>
    </div>
    {expandedMedia && <div className="media-lightbox" role="dialog" aria-modal="true" aria-label={expandedMedia.name} onClick={() => setExpandedMedia(null)}><button type="button" className="media-lightbox-close" aria-label="Close media" onClick={() => setExpandedMedia(null)}><X size={21}/></button><div className="media-lightbox-content" onClick={event => event.stopPropagation()}>{expandedMedia.type === 'image' ? <img src={expandedMedia.url} alt={expandedMedia.name}/> : <video src={expandedMedia.url} controls playsInline/>}<div className="media-lightbox-footer"><strong title={expandedMedia.name}>{expandedMedia.name}</strong><a href={`${expandedMedia.url}${expandedMedia.url.includes('?') ? '&' : '?'}download=1`} download={expandedMedia.name} aria-label="Download attachment"><Download size={18}/><span>Download</span></a></div></div></div>}
  </main>;
}
