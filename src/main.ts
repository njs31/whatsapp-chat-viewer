import type { Chat, Message } from './parse';
import { findMedia, readExport } from './zip';
import './styles.css';

const SOURCE = 'https://github.com/njs31/whatsapp-chat-viewer';

type Loaded = {
  chat: Chat;
  media: Map<string, Blob>;
  urls: Map<Blob, string>;
};

const root = document.querySelector<HTMLDivElement>('#app');
if (!root) throw new Error('Missing app root');
const app: HTMLDivElement = root;

const picker = document.createElement('input');
picker.type = 'file';
picker.accept = '.zip,.txt,application/zip,text/plain';
picker.className = 'sr';
picker.setAttribute('aria-label', 'Open a WhatsApp export');

let loaded: Loaded | null = null;
let query = '';

picker.addEventListener('change', () => {
  const file = picker.files?.[0];
  if (file) void openFile(file);
  picker.value = '';
});

document.addEventListener('dragover', (event) => {
  event.preventDefault();
  app.classList.add('is-dragging');
});

document.addEventListener('dragleave', (event) => {
  if (event.target === document.documentElement) app.classList.remove('is-dragging');
});

document.addEventListener('drop', (event) => {
  event.preventDefault();
  app.classList.remove('is-dragging');
  const file = event.dataTransfer?.files?.[0];
  if (file) void openFile(file);
});

document.addEventListener('keydown', (event) => {
  if (event.key === '/' && document.activeElement?.tagName !== 'INPUT') {
    event.preventDefault();
    app.querySelector<HTMLInputElement>('.search')?.focus();
  }
});

renderGate();

async function openFile(file: File) {
  const status = app.querySelector('.status');
  if (status) status.textContent = 'Reading export…';

  try {
    const result = await readExport(file);
    if (result.chat.messages.length === 0) {
      showStatus('This file does not look like a WhatsApp export.');
      return;
    }
    revoke();
    loaded = { ...result, urls: new Map() };
    query = '';
    renderChat();
  } catch (error) {
    showStatus(error instanceof Error ? error.message : 'Could not read that file.');
  }
}

function showStatus(message: string) {
  if (!loaded) {
    renderGate(message);
    return;
  }
  const status = app.querySelector('.sub');
  if (status) status.textContent = message;
}

function renderGate(status = '') {
  app.replaceChildren();
  const gate = el('section', 'gate');
  const card = el('div', 'gate-card');
  card.append(
    el('h1', '', 'WhatsApp chat'),
    el(
      'p',
      'lede',
      'This runs completely in your browser. Nothing is uploaded, so your privacy is not compromised.',
    ),
  );
  const open = el('button', '', 'Open export') as HTMLButtonElement;
  open.type = 'button';
  open.addEventListener('click', () => picker.click());
  card.append(open, el('p', 'hint', 'or drop a .zip or .txt'));
  const repo = el('p', 'repo');
  repo.append(sourceLink('github.com/njs31/whatsapp-chat-viewer'));
  card.append(repo);
  if (status) card.append(el('p', 'status', status));
  gate.append(card);
  app.append(gate, picker);
}

function renderChat() {
  if (!loaded) return;
  const { chat } = loaded;
  const contact = contactName(chat);

  app.replaceChildren();
  const shell = el('section', 'shell');
  const bar = el('header', 'bar');
  bar.append(el('div', 'avatar', initial(contact)));
  const identity = el('div', 'identity');
  identity.append(el('h1', '', contact));
  const sub = el('p', 'sub');
  fillSummary(sub, chat, filterMessages(chat.messages, query).length);
  identity.append(sub);
  const actions = el('div', 'actions');
  const pdf = el('button', 'pdf-btn', 'PDF') as HTMLButtonElement;
  pdf.type = 'button';
  pdf.title = 'Export a multi-page PDF';
  pdf.setAttribute('aria-label', 'Export PDF');
  pdf.addEventListener('click', () => exportPdf(contact));
  const open = el('button', 'icon-btn') as HTMLButtonElement;
  open.type = 'button';
  open.setAttribute('aria-label', 'Open another export');
  open.append(dotsIcon());
  open.addEventListener('click', () => picker.click());
  actions.append(pdf, open);
  bar.append(identity, actions);

  const printHead = el('header', 'print-head');
  printHead.setAttribute('aria-hidden', 'true');
  printHead.append(
    el('h1', '', contact),
    el('p', '', 'Exported in this browser. This chat was never uploaded.'),
  );
  const thread = renderThread(chat.messages);
  const composer = el('form', 'composer');
  composer.addEventListener('submit', (event) => event.preventDefault());
  const add = el('button', 'icon-btn') as HTMLButtonElement;
  add.type = 'button';
  add.setAttribute('aria-label', 'Open another export');
  add.append(plusIcon());
  add.addEventListener('click', () => picker.click());
  const search = document.createElement('input');
  search.className = 'search';
  search.type = 'search';
  search.placeholder = 'Search';
  search.value = query;
  search.setAttribute('aria-label', 'Search messages');
  search.addEventListener('input', () => {
    query = search.value;
    const next = renderThread(chat.messages);
    app.querySelector('.thread')?.replaceWith(next);
    const sub = app.querySelector<HTMLElement>('.sub');
    if (sub) fillSummary(sub, chat, filterMessages(chat.messages, query).length);
  });
  composer.append(add, search);
  shell.append(bar, printHead, thread, composer, picker);
  app.append(shell);
  thread.scrollTop = thread.scrollHeight;
}

function renderThread(messages: Message[]): HTMLElement {
  const thread = el('main', 'thread');
  const visible = filterMessages(messages, query);
  if (!visible.length) {
    thread.append(el('p', 'empty-result', 'No messages match.'));
    return thread;
  }

  const chat = loaded?.chat;
  let lastDay = '';
  let lastSender = '';
  for (const message of visible) {
    if (message.dateKey !== lastDay) {
      thread.append(el('div', 'day', message.dayLabel));
      lastDay = message.dateKey;
      lastSender = '';
    }

    if (message.system) {
      const note = el('p', 'system');
      note.append(document.createTextNode(message.text));
      const time = document.createElement('time');
      time.dateTime = message.at.toISOString();
      time.textContent = message.timeLabel;
      note.append(time);
      thread.append(note);
      lastSender = '';
      continue;
    }

    const outgoing = chat ? isOutgoing(chat, message.sender) : false;
    const follow = message.sender === lastSender;
    const bubble = el(
      'article',
      `bubble ${outgoing ? 'out' : 'in'}${follow ? ' follow' : ' gap'}`,
    );
    const stamp = document.createElement('time');
    stamp.className = 'stamp';
    stamp.dateTime = message.at.toISOString();
    stamp.textContent = message.timeLabel;
    if (outgoing) stamp.append(ticks());
    if (message.text && !message.attachments.length) {
      const text = linkify(message.text);
      text.append(stamp);
      bubble.append(text);
    } else {
      if (message.text) bubble.append(linkify(message.text));
      if (message.attachments.length) bubble.append(renderFiles(message));
      bubble.append(stamp);
    }
    thread.append(bubble);
    lastSender = message.sender;
  }

  return thread;
}

function renderFiles(message: Message): HTMLElement {
  const files = el('div', 'files');
  for (const attachment of message.attachments) {
    const blob = loaded ? findMedia(loaded.media, attachment.name) : undefined;
    const label = attachment.name.split('/').pop()?.replace(/^\d+-/, '') || attachment.name;
    if (!blob) {
      files.append(el('p', 'missing', `${label} is not in this export`));
      continue;
    }

    const url = objectUrl(blob);
    if (attachment.kind === 'image') {
      const image = document.createElement('img');
      image.src = url;
      image.alt = label;
      image.addEventListener('click', () => openImage(url, label));
      files.append(image);
      continue;
    }

    if (attachment.kind === 'video' || attachment.kind === 'audio') {
      const media = document.createElement(attachment.kind);
      media.src = url;
      media.controls = true;
      media.preload = 'metadata';
      files.append(media);
      continue;
    }

    const row = el('div', 'file');
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = label;
    row.append(link, el('span', '', formatSize(blob.size)));
    files.append(row);
  }
  return files;
}

function openImage(url: string, label: string) {
  const dialog = document.createElement('dialog');
  const image = document.createElement('img');
  image.src = url;
  image.alt = label;
  dialog.append(image);
  dialog.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}

function linkify(text: string): HTMLElement {
  const paragraph = el('p', 'text');
  const pattern = /https?:\/\/[^\s<]+/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0;
    paragraph.append(document.createTextNode(text.slice(cursor, start)));
    const raw = match[0];
    const trimmed = raw.replace(/[),.]+$/g, '');
    const link = document.createElement('a');
    link.href = trimmed;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = trimmed;
    paragraph.append(link);
    if (trimmed.length !== raw.length) {
      paragraph.append(document.createTextNode(raw.slice(trimmed.length)));
    }
    cursor = start + raw.length;
  }
  paragraph.append(document.createTextNode(text.slice(cursor)));
  return paragraph;
}

function filterMessages(messages: Message[], value: string): Message[] {
  const needle = value.trim().toLowerCase();
  if (!needle) return messages;
  return messages.filter((message) => {
    const haystack = [
      message.sender,
      message.text,
      ...message.attachments.map((attachment) => attachment.name),
    ]
      .join('\n')
      .toLowerCase();
    return haystack.includes(needle);
  });
}

function contactName(chat: Chat): string {
  const title = chat.title.trim().toLowerCase();
  const match = chat.participants.find((name) => {
    const value = name.trim().toLowerCase();
    return value === title || (title && (title.includes(value) || value.includes(title)));
  });
  return match || chat.participants[0] || chat.title || 'Chat';
}

function isOutgoing(chat: Chat, sender: string): boolean {
  return sender !== contactName(chat);
}

function initial(name: string): string {
  const letter = name.trim().charAt(0);
  return letter ? letter.toUpperCase() : '?';
}

function fillSummary(node: HTMLElement, chat: Chat, shown: number) {
  node.replaceChildren();
  if (query.trim()) {
    const count =
      shown === chat.messages.length
        ? `${chat.messages.length} messages`
        : `${shown} of ${chat.messages.length}`;
    node.append(document.createTextNode(`${count} · `));
  }
  node.append(document.createTextNode('Stays in this browser · '));
  node.append(sourceLink('Source'));
}

function sourceLink(label: string): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = SOURCE;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = label;
  return link;
}

function exportPdf(contact: string) {
  if (!loaded) return;
  const previousQuery = query;
  const previousTitle = document.title;
  query = '';
  const full = renderThread(loaded.chat.messages);
  app.querySelector('.thread')?.replaceWith(full);
  document.title = `${contact} — WhatsApp chat`;

  const restore = () => {
    query = previousQuery;
    document.title = previousTitle;
    window.removeEventListener('afterprint', restore);
    if (!loaded) return;
    const next = renderThread(loaded.chat.messages);
    app.querySelector('.thread')?.replaceWith(next);
    const sub = app.querySelector<HTMLElement>('.sub');
    if (sub) fillSummary(sub, loaded.chat, filterMessages(loaded.chat.messages, query).length);
  };

  window.addEventListener('afterprint', restore);
  window.print();
}

function svg(paths: string[]): SVGSVGElement {
  const node = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  node.setAttribute('viewBox', '0 0 24 24');
  node.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('d', d);
    node.append(path);
  }
  return node;
}

function dotsIcon(): SVGSVGElement {
  return svg([
    'M6 10.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z',
  ]);
}

function plusIcon(): SVGSVGElement {
  return svg(['M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z']);
}

function ticks(): HTMLElement {
  const wrap = el('span', 'ticks');
  wrap.append(
    svg([
      'M1.6 12.4 5.2 16l7.2-8.2-1.3-1.2L5.2 13.5 2.9 11.2zm6.2 0L11.4 16l7.2-8.2-1.3-1.2-5.9 6.7-1.3-1.3z',
    ]),
  );
  return wrap;
}

function objectUrl(blob: Blob): string {
  if (!loaded) return URL.createObjectURL(blob);
  const existing = loaded.urls.get(blob);
  if (existing) return existing;
  const url = URL.createObjectURL(blob);
  loaded.urls.set(blob, url);
  return url;
}

function revoke() {
  if (!loaded) return;
  for (const url of loaded.urls.values()) URL.revokeObjectURL(url);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 104857.6) / 10} MB`;
}

function el(tag: string, className = '', text = ''): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}
