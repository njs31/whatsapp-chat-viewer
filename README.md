# WhatsApp chat viewer

Read a WhatsApp chat export in your browser. The site is at [whatsapp-chat-viewer.webxai.in](https://whatsapp-chat-viewer.webxai.in).

This runs completely in the browser. The `.zip` or `.txt` export is parsed on your device and is never uploaded, so the chat stays private.

## Use it

1. In WhatsApp, export a chat (with or without media).
2. Open the site and choose that file, or drop it on the page.
3. Use **PDF** to print the chat or save it as a PDF. The print layout flows onto multiple A4 pages, with each message kept together when it fits on one page. In the print dialog, choose **Save as PDF**. That file is created locally too.

The name in the export filename is shown on the left. Other senders are on the right. Exports do not include read receipts, so the ticks are only visual.

## Develop

```bash
npm install
npm run dev
npm run check
npm run build
```

## License

[MIT](LICENSE)
