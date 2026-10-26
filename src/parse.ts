export type AttachmentKind = 'image' | 'video' | 'audio' | 'pdf' | 'file';

export type Attachment = {
  name: string;
  kind: AttachmentKind;
};

export type Message = {
  id: number;
  at: Date;
  dateKey: string;
  dayLabel: string;
  timeLabel: string;
  sender: string;
  text: string;
  attachments: Attachment[];
  system: boolean;
};

export type Chat = {
  title: string;
  messages: Message[];
  participants: string[];
};

const INVISIBLE = /[\u200e\u200f\u202a-\u202e\ufeff]/g;

const MARKS = '(?:[\\u200e\\u200f\\u202a-\\u202e\\ufeff])*';

const HEADER = new RegExp(
  `^${MARKS}\\[(\\d{1,2})\\/(\\d{1,2})\\/(\\d{2,4}),\\s+(\\d{1,2}):(\\d{2})(?::(\\d{2}))?(?:\\s*([AP]M))?\\]\\s+([\\s\\S]*)$`,
  'i',
);

const ANDROID = new RegExp(
  `^${MARKS}(\\d{1,2})\\/(\\d{1,2})\\/(\\d{2,4}),\\s+(\\d{1,2}):(\\d{2})(?::(\\d{2}))?(?:\\s*([AP]M))?\\s+-\\s+([\\s\\S]*)$`,
  'i',
);

const ATTACHED_SOURCE = '<attached:\\s*([^>]+)>';

const SYSTEM = [
  /messages and calls are end-to-end encrypted/i,
  /\bis a contact\b/i,
  /voice call/i,
  /video call/i,
  /this message was deleted/i,
  /you deleted this message/i,
  /security code changed/i,
  /disappearing messages/i,
  /changed the subject/i,
  /changed this group's icon/i,
  /joined using this group's invite/i,
  /^you (created|added|removed|left|changed)\b/i,
];

export function parseChat(raw: string, title = 'Chat'): Chat {
  const lines = raw.replace(/^\uFEFF/, '').split(/\r?\n/);
  const messages: Message[] = [];
  let current: Message | null = null;

  const commit = () => {
    if (!current) return;
    current.text = tidyText(current.text, current.attachments);
    current.system =
      current.attachments.length === 0 && isSystem(current.sender, current.text);
    messages.push(current);
    current = null;
  };

  for (const line of lines) {
    if (!line.trim()) {
      if (current) current.text += '\n';
      continue;
    }

    const header = matchHeader(line);
    if (!header) {
      if (current) current.text += `\n${line.replace(INVISIBLE, '')}`;
      continue;
    }

    commit();
    const split = splitSender(header.rest);
    const attachments = takeAttachments(split.text);
    current = {
      id: messages.length,
      at: header.at,
      dateKey: dateKey(header.at),
      dayLabel: dayLabel(header.at),
      timeLabel: timeLabel(header.at),
      sender: split.sender,
      text: split.text,
      attachments,
      system: false,
    };
  }

  commit();
  messages.forEach((message, index) => {
    message.id = index;
  });

  const participants = [
    ...new Set(
      messages.flatMap((message) =>
        message.sender && !message.system ? [message.sender] : [],
      ),
    ),
  ];

  return { title, messages, participants };
}

function matchHeader(line: string): { at: Date; rest: string } | null {
  const match = line.match(HEADER) ?? line.match(ANDROID);
  if (!match) return null;

  const first = Number(match[1]);
  const second = Number(match[2]);
  const resolved = resolveDayMonth(first, second);
  if (!resolved) return null;

  let year = Number(match[3]);
  if (year < 100) year += 2000;

  let hour = Number(match[4]);
  const minute = Number(match[5]);
  const secondOfMinute = match[6] ? Number(match[6]) : 0;
  const meridiem = match[7]?.toUpperCase();
  if (meridiem === 'PM' && hour < 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59 || secondOfMinute > 59) return null;

  return {
    at: new Date(year, resolved.month - 1, resolved.day, hour, minute, secondOfMinute),
    rest: match[8] ?? '',
  };
}

function resolveDayMonth(
  first: number,
  second: number,
): { day: number; month: number } | null {
  if (first > 31 || second > 31 || first < 1 || second < 1) return null;
  if (first > 12 && second <= 12) return { day: first, month: second };
  if (second > 12 && first <= 12) return { day: second, month: first };
  if (first <= 12 && second <= 12) return { day: first, month: second };
  return null;
}

function splitSender(rest: string): { sender: string; text: string } {
  const cleaned = rest.replace(INVISIBLE, '');
  const splitAt = cleaned.indexOf(': ');
  if (splitAt === -1 || splitAt > 80) return { sender: '', text: cleaned.trim() };
  return {
    sender: cleaned.slice(0, splitAt).trim(),
    text: cleaned.slice(splitAt + 2),
  };
}

function takeAttachments(text: string): Attachment[] {
  return [...text.matchAll(new RegExp(ATTACHED_SOURCE, 'gi'))].map((match) => {
    const name = match[1].trim();
    return { name, kind: kindFromName(name) };
  });
}

export function kindFromName(name: string): AttachmentKind {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(extension)) return 'image';
  if (['mp4', 'mov', 'webm', '3gp'].includes(extension)) return 'video';
  if (['mp3', 'm4a', 'ogg', 'opus', 'wav', 'aac'].includes(extension)) return 'audio';
  if (extension === 'pdf') return 'pdf';
  return 'file';
}

function tidyText(text: string, attachments: Attachment[]): string {
  const cleaned = text
    .replace(INVISIBLE, '')
    .replace(new RegExp(ATTACHED_SOURCE, 'gi'), '')
    .replace(/[ \t]*•[ \t]*\d+[ \t]+pages?/gi, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!attachments.length) return cleaned;
  const compact = cleaned.replace(/\s+/g, '');
  const names = attachments.flatMap((attachment) => {
    const base = attachment.name.split('/').pop() ?? attachment.name;
    return [base, base.replace(/^\d+-/, '')];
  });
  if (names.some((name) => compact === name || cleaned === name)) return '';
  return cleaned;
}

function isSystem(sender: string, text: string): boolean {
  if (!sender) return true;
  return SYSTEM.some((pattern) => pattern.test(text));
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function dayLabel(date: Date): string {
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' });
  const month = date.toLocaleDateString('en-GB', { month: 'short' });
  return `${weekday}, ${date.getDate()} ${month}`;
}

function timeLabel(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}
