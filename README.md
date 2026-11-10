<p align="center">
  <img src="public/favicon.svg" width="96" height="96" alt="">
</p>

<h1 align="center">QR Code Pocket</h1>

<p align="center">
  <strong>Keep all your QR codes in your pocket: tickets, entries, reservations, boarding passes, loyalty cards, Wi-Fi.</strong><br>
  Save a QR code from a screenshot or PDF, keep it in one place, show it full screen at the gate.<br>
  Local-first. Works offline. No account. Installs to your Home Screen.
</p>

<p align="center">
  <a href="https://peetzweg.github.io/qr-code-pocket/"><strong>Open QR Code Pocket →</strong></a>
</p>

<p align="center">
  <img src="public/og.png" width="720" alt="QR Code Pocket: a train ticket, Nozomi 23 from Tokyo to Kyoto at 10:03, its QR code drawn with rounded modules inside a dashed crop frame.">
</p>

Travelling, you collect QR codes everywhere: Shinkansen and rail tickets, museum and attraction entries,
restaurant bookings, takeaway order numbers, boarding passes, event tickets. They end up as screenshots in
your camera roll and PDFs in your email. QR Code Pocket keeps them in one place, reads what they are, and
puts the right one on screen when you need it.

People call this a QR code wallet, a QR code keeper, holder or saver; whatever the word, the job is the
same: keep the codes you'd otherwise dig out of screenshots and emails, and show the right one at the gate.

## Install

It's a progressive web app (PWA). No App Store, no sign-up, and your codes never leave your phone.

- **iPhone and iPad:** open [the app](https://peetzweg.github.io/qr-code-pocket/) in Safari, tap **Share**,
  then **Add to Home Screen**.
- **Android:** open it in Chrome and tap **Install app** (or **⋮ → Add to Home screen**).
- **Desktop:** Chrome and Edge show an install button in the address bar.

Once installed it opens full screen and works offline.

## Save any QR code, from anywhere

- **From a screenshot.** Pick it from Photos; the QR code or barcode (EAN, Code 128…) is found and decoded on your phone.
- **From a PDF ticket.** E-tickets from email: every page is scanned, and the PDF's text is read for the details.
- **With the camera.** Scan a printed voucher or a code on someone else's screen.
- **Paste or type.** A copied image, a link, or a booking number to turn into a QR code.
- **From the share sheet** (when you [host it yourself](#host-it-yourself)): on iPhone via a one-tap
  Shortcut; on Android, the app is a share target.

Supported codes: **QR**, **Aztec** (airline boarding passes), **PDF417**, **Data Matrix**, **Code 128**,
**EAN-13**, **ITF** and more (via [zxing-cpp](https://github.com/zxing-cpp/zxing-cpp) compiled to WebAssembly).

## It reads the ticket for you

Most of the time you just confirm. The details come from two places, and each value says which:

- **The code itself:** an airline boarding pass (IATA BCBP) gives passenger, flight, route, date, seat and
  booking reference; booking links from Klook, KKday, TableCheck, Smart EX, Eki-net and others give the
  issuer, order number and visit date; calendar codes give the event, place and start time; Wi-Fi codes
  give the network and password.
- **The text around it:** read on your phone in Japanese and English
  ([Tesseract](https://github.com/naptha/tesseract.js), offline). It recognises Shinkansen reservations
  (train, departure and arrival stations, car and seat), museum entries, restaurant bookings and dates in
  Japanese and Western formats.

## Show it at the gate

<p>
  <img src="docs/screens/stack.png" width="200" alt="Upcoming tickets stacked like a wallet, each kind with its own die-cut shape">
  <img src="docs/screens/ticket.png" width="200" alt="A train ticket open full screen, its content running round the QR code as microprint">
  <img src="docs/screens/cards.png" width="200" alt="The Cards tab: a hotel Wi-Fi with its password, and a Starbucks card with its logo">
  <img src="docs/screens/night-flood.png" width="200" alt="The same train ticket at night, the colour flooding the page">
</p>

- **A wallet, not a list.** Upcoming tickets sit in a stack, the next one on top with a countdown. Tap one
  and it springs up while the rest tuck into a pile below; pull it down to put it back, flick sideways
  through the rest. Hold one and drag it through the stack to put your tickets in your own order.
- **The code as big as the screen allows**, with the screen kept awake. **Bright** puts it on a lit plate.
- **Plain** shows the classic black-on-white code for fussy scanners; **Original** shows your screenshot.
- **Mark as used** stamps the ticket into **Collected**: the trip, ticket by ticket, with a few numbers on top.
- **Share** a ticket as an image, printed exactly as it looks in the app.

## Cards: the things you keep

Some codes aren't used up: **loyalty and membership cards** (IKEA Family, Starbucks, a supermarket's
points card) and **Wi-Fi networks**. They live in their own **Cards** tab, which only appears once you have
one. A card shows its number for the cashier and its store's logo in full colour; a Wi-Fi shows its
password, for the laptop that can't scan. Instead of being marked as used, they're **archived** into
Collected, and come back with one tap. Barcodes are always printed dark on white, because checkout
scanners can't read them inverted.

## Printed in the house style

Every ticket is printed in exactly two colours, like a print job. The colour is yours: pick one from the
omakase set of traditional Japanese colours (墨 Sumi, 藍 Ai, 朱 Shu, 抹茶 Matcha and more) or your own, with a
look for day and for night. Everything else is the house's choice, omakase: each kind of ticket has its
own die-cut shape (clipped corners on trains, rounded boarding passes, scalloped admissions, a receipt's
torn edge for food), the code is redrawn from its exact content with high error correction, the code's own
content runs round it as microprint, and a used ticket gets a rubber date stamp. The redrawn code is
checked against a real decoder (`scripts/qr-scan-test.mjs`).

## Private by design

- Everything is stored in your browser's storage on your phone (IndexedDB). There is no server-side copy.
- Codes are decoded, and screenshots read, on the device. Nothing is uploaded.
- No account, no analytics, no ads.
- Export a backup file any time; import it on a new phone.

## FAQ

**How do I save a QR code from a screenshot on iPhone?** Open QR Code Pocket, tap **+ Add**, choose
**Photos & files**, pick the screenshot. The code is decoded on your phone.

**Can I keep loyalty cards and Wi-Fi passwords in it?** Yes. Add a screenshot or photo of the card's
barcode, or a Wi-Fi QR code; they go to the **Cards** tab and stay there until you archive them.

**Can I add these codes to Apple Wallet or Google Wallet?** Not yet. It's planned (see the research in
[docs/research](docs/research)). Until then, QR Code Pocket itself is the wallet.

**Does it work offline?** Yes, once it's on your Home Screen: the app, the code reader and the text
recognition all work without a connection.

**Will the gate scanner accept a redrawn code?** It encodes the same content, so it reads the same. If one
refuses, use **Plain** (classic black on white) or **Original** (your screenshot).

**Is it free?** Yes, and open source (MIT).

## How it compares

| | QR Code Pocket | Screenshot album | "QR to Apple Wallet" apps |
| --- | --- | --- | --- |
| Reads the details for you | Yes, from the code and the ticket text | No | Mostly typed by hand |
| Works offline | Yes | Yes | Varies |
| Uploads your codes | No | No | Usually, to sign the pass on a server |
| Keeps used tickets as a record | Yes, Collected | Mixed in with photos | No |
| Account or App Store needed | No | No | Yes |

## Host it yourself

The public copy on GitHub Pages is a static site. Everything runs in the browser, so it's the full app,
except for two extras that need a server: receiving files from the **share sheet**, and fetching a
loyalty card's **logo from the store's website** (on Pages you pick the logo image yourself). To get
both, run the app with its small dependency-free server, for example on a home machine reachable over
[Tailscale](https://tailscale.com):

```sh
pnpm install
pnpm build                                          # copies OCR/pdf.js assets into public/, builds dist/
node server.mjs                                     # dist, share inbox and logo lookup on 127.0.0.1:5182
scripts/shortcut.sh https://<your-host> && pnpm build   # optional: signed iOS "Add to Pocket" Shortcut
```

| Variable | Used for |
| --- | --- |
| `SITE_URL` | The deployed origin (and path), so canonical, Open Graph and sitemap URLs are absolute |
| `BASE_PATH` | Serve from a sub-path, e.g. `/qr-code-pocket/` on GitHub Pages |
| `STATIC=1` | Static build: no share target in the manifest |

GitHub Pages is deployed by [`.github/workflows/pages.yml`](.github/workflows/pages.yml) on every push to `main`.

## Develop

Vite, React and TypeScript, with plain CSS. [zxing-wasm](https://github.com/Sec-ant/zxing-wasm) reads and
writes the codes, [pdf.js](https://mozilla.github.io/pdf.js/) opens PDFs,
[tesseract.js](https://github.com/naptha/tesseract.js) reads text, [motion](https://motion.dev) springs
the wallet stack, [Phosphor](https://phosphoricons.com) draws the icons, and
[vite-plugin-pwa](https://vite-pwa-org.netlify.app) makes it installable.

```sh
pnpm dev          # dev server
pnpm typecheck
node scripts/qr-scan-test.mjs   # every code style must decode back byte for byte
```

| Path | What's there |
| --- | --- |
| `src/scan/` | Code detection and drawing, PDF pages, OCR, ticket-text and payload parsing, logo lookup |
| `src/store/` | IndexedDB, tickets, backup |
| `src/ui/` | Wallet stack, ticket face and shapes, stamp, microprint loop, sheets, review flow, settings |
| `src/theme.ts` | The two-colour system: day and night looks, omakase colours |
| `server.mjs` | Static server, share inbox and logo lookup, no dependencies |
| `scripts/` | Decode test for the code styles, brand assets, OCR assets, the iOS Shortcut |

**Brand assets:** `public/favicon.svg` is the app icon; all PNG icons, the maskable icon and iOS launch
screens are generated from it at build. `public/og.png` is the share image. Both are made by
`scripts/brand/`.

Issues and pull requests are welcome.

## License

[MIT](LICENSE)
