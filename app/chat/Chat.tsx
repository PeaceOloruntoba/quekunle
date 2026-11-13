'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, CheckCheck, FileText, LogOut, Mic, Paperclip, Reply, Send, Smile, SmilePlus, Square, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

export default function Chat({ me }: { me: { id: string; name: string } }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [reactingTo, setReactingTo] = useState<number | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const socket = useRef<WebSocket | null>(null);
  const router = useRouter();

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
    const connect = () => {
      if (stopped) return;
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${location.host}/api/ws`);
      socket.current = ws;
      ws.onopen = () => { delay = 1000; void load(); };
      ws.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'message' && data.message) mergeMessage(data.message as Message);
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
        retry = setTimeout(connect, delay);
        delay = Math.min(delay * 2, 20000);
      };
      ws.onerror = () => ws.close();
    };
    void load();
    connect();
    return () => { stopped = true; clearTimeout(retry); socket.current?.close(); socket.current = null; };
  }, [load, mergeMessage]);

  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: 'smooth' }); }, [messages]);

  async function upload(selected: File) {
    const response = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: selected.name, type: selected.type, size: selected.size }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    const uploaded = await fetch(data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': selected.type }, body: selected });
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
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      recorder.current = mediaRecorder; chunks.current = [];
      mediaRecorder.ondataavailable = event => chunks.current.push(event.data);
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        const voice = new File(chunks.current, `voice-note-${Date.now()}.webm`, { type: mediaRecorder.mimeType || 'audio/webm' });
        setFile(voice); setRecording(false);
      };
      mediaRecorder.start(); setRecording(true);
    } catch { setError('Allow microphone access to record a voice note.'); }
  }

  function time(value: string) { return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
  function replyText(message: Message) {
    if (message.body) return message.body;
    if (message.attachment_type?.startsWith('image/')) return 'Photo';
    if (message.attachment_type?.startsWith('video/')) return 'Video';
    if (message.attachment_type?.startsWith('audio/')) return 'Voice note';
    return message.attachment_name || 'Attachment';
  }

  return <main className="chat-page">
    <header className="chat-header">
      <Link href="/" className="chat-back" aria-label="Home"><ArrowLeft size={19}/></Link>
      <div className="chat-avatar">{me.name.startsWith('Queen') ? 'Q' : 'P'}<span>✿</span></div>
      <div className="chat-title"><strong>{me.name.startsWith('Queen') ? 'Peace Adekunle' : 'Queen Moyosore'}</strong><span><i/> Just us, always</span></div>
      <button className="chat-logout" onClick={logout} title="Log out"><LogOut size={17}/></button>
    </header>
    <div className="chat-wallpaper">
      <div className="chat-date">A LITTLE SPACE FOR US <span>♥</span></div>
      <div className="message-list" ref={list}>
        {messages.map(message => {
          const mine = message.sender_id === me.id;
          const groups = Array.from(new Set(message.reactions.map(reaction => reaction.emoji)));
          return <article key={message.id} className={`message ${mine ? 'mine' : 'theirs'}`}>
            <div className="message-bubble">
              {message.reply_to_id && <div className="reply-preview"><strong>{message.reply_sender_name || 'A message'}</strong><span>{message.reply_body || 'Attachment'}</span></div>}
              {message.attachment_url && <div className="attachment">
                {message.attachment_type?.startsWith('image/') ? <a href={message.attachment_url} target="_blank" rel="noreferrer"><img src={message.attachment_url} alt={message.attachment_name || 'Shared image'}/></a>
                  : message.attachment_type?.startsWith('video/') ? <video src={message.attachment_url} controls/>
                    : message.attachment_type?.startsWith('audio/') ? <audio src={message.attachment_url} controls/>
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
            <div className="message-tools">
              <button onClick={() => { setReplyingTo(message); setReactingTo(null); }} title="Reply to this message" aria-label="Reply"><Reply size={15}/></button>
              <button onClick={() => setReactingTo(reactingTo === message.id ? null : message.id)} title="React to this message" aria-label="React"><SmilePlus size={15}/></button>
            </div>
            {reactingTo === message.id && <div className="message-reaction-picker">{emojis.map(emoji => <button key={emoji} onClick={() => react(message.id, emoji)} aria-label={`React ${emoji}`}>{emoji}</button>)}</div>}
          </article>;
        })}
        {messages.length === 0 && <div className="empty-chat"><span>🌿</span><strong>Your little world is waiting.</strong><p>Say hi and make the first memory.</p></div>}
      </div>
    </div>
    <div className="composer-wrap">
      {error && <div className="chat-error">{error}<button onClick={() => setError('')}><X size={14}/></button></div>}
      {replyingTo && <div className="replying-banner"><div><strong>Replying to {replyingTo.sender_name}</strong><span>{replyText(replyingTo)}</span></div><button onClick={() => setReplyingTo(null)} aria-label="Cancel reply"><X size={16}/></button></div>}
      {file && <div className="file-chip"><Paperclip size={14}/>{file.name}<button onClick={() => setFile(null)} aria-label="Remove attachment"><X size={15}/></button></div>}
      {emojiOpen && <div className="emoji-picker">{emojis.map(emoji => <button key={emoji} onClick={() => setBody(value => value + emoji)}>{emoji}</button>)}</div>}
      <form className="composer" onSubmit={send}>
        <button type="button" className="tool-button" onClick={() => setEmojiOpen(!emojiOpen)} aria-label="Choose emoji"><Smile size={21}/></button>
        <label className="tool-button attach-button" aria-label="Attach a file"><Paperclip size={21}/><input ref={input} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt,.csv" onChange={event => setFile(event.target.files?.[0] || null)}/></label>
        <input className="message-input" value={body} onChange={event => setBody(event.target.value)} placeholder="Write something sweet…" aria-label="Message"/>
        <button type="button" className={`tool-button mic-button ${recording ? 'recording' : ''}`} onClick={record} aria-label={recording ? 'Stop recording' : 'Record voice note'}>{recording ? <Square size={18} fill="currentColor"/> : <Mic size={21}/>}</button>
        <button className="send-button" disabled={sending || (!body.trim() && !file)} aria-label="Send message">{sending ? <span className="sending-dot"/> : <Send size={18}/>}</button>
      </form>
      <div className="composer-note">Messages between just the two of you <span>♥</span></div>
    </div>
  </main>;
}
