# QR Code Wallet (codename Kippu 切符)

A wallet for the QR codes you collect while travelling: Shinkansen tickets, museum entries, lunch
reservations, takeaway orders. Add them from screenshots, PDFs or the camera, keep them in one place on
your Home Screen, and stamp them 済 when used so they move to a History you can look back on.

Local first: passes live in IndexedDB on the phone. Codes are found and redrawn on the device (zxing-wasm),
and the text around them is read by Tesseract (Japanese + English) on the device too, so it works offline.

## Look

Two colours, always: one ink and white, ink on paper or inverted, picked in onboarding. Tickets sit in
a stack like a wallet; tap one and its code grows (View Transitions) into a full-screen ticket, and you
flick sideways through the rest. The code is the hero: redrawn in your style (classic, tiles, liquid,
soft, dots, molecule, pills, engraved, halftone) from the same payload, re-encoded at error correction
H, inside crop marks. A notched tear line carries microprint of the ticket's content, the payload's
bits run along the bottom as bars, with a serial from its hash. Used tickets are postmarked and kept in
Collected. The plain code and the original screenshot are always one tap away.
`node scripts/qr-scan-test.mjs` checks every style decodes. Type: Newsreader (serif) and SF Mono;
icons: Phosphor (light).

Research for later: [Live Activities](docs/research/live-activities.md),
[Apple Wallet passes](docs/research/apple-wallet.md), [Google Wallet passes](docs/research/google-wallet.md).

## Adding codes

- **Photos & Files**: screenshots, or PDF tickets from email (every page is scanned, its text layer read).
- **Scan** with the camera, **Paste** an image, or **Type** a code's text or link.
- **Share sheet**: iOS doesn't let Home Screen web apps receive shares, so the `Add to Kippu` Shortcut
  POSTs to the server's inbox (`/api/inbox`) and the app picks it up when it comes to the front. On Android
  the manifest's share target posts to `/api/share`.

Several screenshots of one booking can be combined into one pass (one code per person).

## Run

```sh
pnpm install
pnpm build                          # copies OCR/pdf.js assets into public/, builds dist/
node server.mjs                     # dist + share inbox on 127.0.0.1:5182
tailscale serve --bg --https=8445 http://127.0.0.1:5182
scripts/shortcut.sh https://<host>.ts.net:8445 && pnpm build   # signed iOS Shortcut for that host
```

| Path | What's there |
| --- | --- |
| `src/scan/` | Code detection and drawing (zxing), PDF pages, OCR, the ticket-text heuristics |
| `src/store/` | IndexedDB, passes, backup |
| `src/ui/` | Deck, full-screen ticket pager, style pager, review flow, settings |
| `server.mjs` | Static server and share inbox, no dependencies |
