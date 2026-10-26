import { strFromU8, unzipSync } from 'fflate';
import { kindFromName, parseChat, type Chat } from './parse';

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  '3gp': 'video/3gpp',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
  wav: 'audio/wav',
  aac: 'audio/aac',
};

export type ExportResult = {
  chat: Chat;
  media: Map<string, Blob>;
};

export async function readExport(file: File): Promise<ExportResult> {
  const title = file.name
    .replace(/\.zip$/i, '')
    .replace(/\.txt$/i, '')
    .replace(/^WhatsApp Chat(?: with)? - /i, '');

  if (file.name.toLowerCase().endsWith('.txt') || file.type.startsWith('text/')) {
    return { chat: parseChat(await file.text(), title || 'Chat'), media: new Map() };
  }

  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
  let chatText = '';
  const media = new Map<string, Blob>();

  for (const [path, bytes] of Object.entries(entries)) {
    const base = path.split('/').pop() ?? path;
    if (!base || base.startsWith('.') || path.startsWith('__MACOSX')) continue;

    if (base.toLowerCase().endsWith('.txt')) {
      const text = strFromU8(bytes);
      if (base === '_chat.txt' || !chatText) chatText = text;
      continue;
    }

    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy], { type: mimeFor(base) });
    media.set(base, blob);
  }

  if (!chatText) throw new Error('This zip has no WhatsApp chat text.');
  return { chat: parseChat(chatText, title || 'Chat'), media };
}

export function findMedia(media: Map<string, Blob>, name: string): Blob | undefined {
  const base = name.split('/').pop() ?? name;
  return media.get(base) ?? media.get(name);
}

function mimeFor(name: string): string {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  return MIME[extension] ?? (kindFromName(name) === 'file' ? 'application/octet-stream' : '');
}
