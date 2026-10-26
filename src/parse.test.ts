import assert from 'node:assert/strict';
import test from 'node:test';
import { parseChat } from './parse.ts';

const SAMPLE = `[06/08/26, 14:11:55] Ada: Messages and calls are end-to-end encrypted. Only people in this chat can read them.
[06/08/26, 14:27:42] Ada: note.pdf • 1 page <attached: 00000006-note.pdf>
[06/08/26, 14:28:12] Bea: This is a receipt
[06/08/26, 19:58:28] Ada: Voice call, Answered on other device
[07/08/26, 9:05:01 AM] Bea: Line one
continues here
06/08/26, 2:11 pm - Bea: Android line
`;

test('parses iOS, Android, attachments, system lines, and wrapped text', () => {
  const chat = parseChat(SAMPLE, 'Studio');
  assert.equal(chat.title, 'Studio');
  assert.equal(chat.messages.length, 6);
  assert.deepEqual(chat.participants, ['Ada', 'Bea']);

  assert.equal(chat.messages[0].system, true);
  assert.equal(chat.messages[1].text, '');
  assert.equal(chat.messages[1].attachments[0].name, '00000006-note.pdf');
  assert.equal(chat.messages[1].attachments[0].kind, 'pdf');
  assert.equal(chat.messages[1].at.getMonth(), 7);
  assert.equal(chat.messages[1].at.getDate(), 6);

  assert.equal(chat.messages[2].sender, 'Bea');
  assert.equal(chat.messages[2].text, 'This is a receipt');
  assert.equal(chat.messages[3].system, true);

  assert.equal(chat.messages[4].text, 'Line one\ncontinues here');
  assert.equal(chat.messages[4].at.getHours(), 9);
  assert.equal(chat.messages[5].text, 'Android line');
  assert.equal(chat.messages[5].at.getHours(), 14);
});
