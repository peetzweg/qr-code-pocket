# Apple Wallet passes from QR Code Wallet (research, 2026-11-08)

## TL;DR
- **It can be done, but it needs a server and a paid account.** A `.pkpass` is a zip file signed with a Pass Type ID certificate. Getting that certificate requires Apple Developer Program membership ($99/yr). The private key can't go into the PWA, so signing has to happen on our Node server. Effort is about 1–2 days once the account exists.
- **License terms are the main grey area.** Apple's terms say passes are distributed "under Your own trademark or brand" and forbid using our Pass Type ID "to sign a third party's pass". A personal copy branded "QR Code Wallet", with no operator logos, is the defensible setup. It is the same pattern commercial pass-creator apps use.
- **There is now a free alternative.** iOS 27 Wallet has a built-in **"Create a Pass"** flow (+ → Create a Pass). It scans a barcode from the camera or a photo, with no developer account. We can't trigger it from the web, but "show the code full-screen, screenshot it, import it in Wallet" works today with no infrastructure. Which barcode formats it reads is undocumented.
- **Two risks need testing on a device:** (a) whether a `.pkpass` link opens the Add-to-Wallet sheet from the **Home Screen (standalone) app** rather than Safari, and (b) byte-exact re-encoding of binary payloads.

## 1. Format
A `.pkpass` is a flat zip file containing:
- `pass.json`
- the images
- `manifest.json`: a SHA-1 hash of every file
- `signature`: a detached PKCS#7 signature of the manifest, made with the Pass Type ID certificate's private key, with Apple's **WWDR G4** intermediate included

**Required `pass.json` keys:** `formatVersion: 1`, `passTypeIdentifier`, `teamIdentifier`, `serialNumber`, `organizationName`, `description`, plus exactly one style key: `boardingPass`, `eventTicket`, `generic`, `storeCard` or `coupon`.

**Barcodes:** `barcodes[]` takes `{format, message, messageEncoding, altText}`.
- Formats: `PKBarcodeFormatQR`, `PKBarcodeFormatAztec`, `PKBarcodeFormatPDF417`, `PKBarcodeFormatCode128`.
- iOS 27 adds EAN-13, Code 39, Codabar and ITF, and lets you list several barcodes as fallbacks.
- `messageEncoding` is required and is an IANA charset name, e.g. `iso-8859-1` or `utf-8`.

**Which style to use:**
- Trains: `boardingPass` with `transitType: PKTransitTypeTrain`.
- Concerts and similar: `eventTicket`.
- Anything else: `generic`.
- The terms require the matching template ("You will not use the boarding pass template for a movie ticket").

**Other useful keys:**
- Colours: `backgroundColor`, `foregroundColor`, `labelColor`.
- `locations` (up to 10).
- `relevantDates` (iOS 18+; `relevantDate` is deprecated but still worth including for older iOS).
- `semantics`. Rail tags exist: `departureStationName`, `carNumber`, `seats`, `vehicleNumber`, `departurePlatform`, and others.

**Images:** `icon.png` is mandatory on every pass (38×38 pt, ship @2x and @3x). `logo.png` is optional (50–160 × 50 pt). `thumbnail.png` and `background.png` work on event tickets.

## 2. Requirements and rules
- **Account and certificate:** paid developer membership, then in the developer portal create a Pass Type ID (e.g. `pass.<domain>.qrwallet`), then a Pass Type ID Certificate from a CSR. There is no way to sign without one. A self-signed certificate is rejected.
- **What the terms say:**
  - A pass must carry our own brand.
  - If it references a third party's trademark, we warrant that we have the rights.
  - We must not sign a third party's pass.
  - The pass must state a contact name, address, phone number and email.
- **What that means for us:**
  - `organizationName`: "QR Code Wallet".
  - Operator names only as plain text in fields (e.g. "Tōkaidō Shinkansen").
  - No JR or airline logos, and nothing that looks official.
  - A contact field on the back of the pass.
  - Because these are personal copies we don't distribute, the risk is low. It is still an interpretation, not legal advice.
- **Other apps:** PassX states that pass data stays on the device and only metadata goes to its server for signing. WalletWallet says it "runs in your browser" but doesn't document how it signs, and it can't sign client-side without exposing a key. PassSlot says shared certificates are for evaluation only. I couldn't confirm how Pass4Wallet, Code2Wallet or IntoWallet sign.

## 3. Delivery from the PWA
- **Server:** serve the pass with `Content-Type: application/vnd.apple.pkpass` from a **GET** URL. Forum reports say POST downloads fail in some iOS browsers.
- **Safari and Safari View Controller** open the Add-to-Wallet sheet natively.
- **Standalone Home Screen mode is UNVERIFIED.** I found no source either way, so we need a spike. Fallbacks if it fails:
  - serve the pass from a URL outside the manifest `scope`, so iOS opens it in its in-app Safari view (which Apple documents as able to import passes)
  - or tell the user to open the link in Safari
- **Badge:** use the official "Add to Apple Wallet" SVG unmodified, only next to a real pass, and only while we're a program member.
- **Libraries:**
  - **passkit-generator** (Node): v3.7.0 released 2026-10-14, about 1.3k stars, actively pushed, uses node-forge. Recommended.
  - **@walletpass/pass-js**: v7.2.0 released 2026-05-11, maintained.

## 4. Extras
- **Updates (`webServiceURL` plus APNs push):** not needed. Our passes are static, and re-issuing with the same `serialNumber` replaces the old pass.
- **iOS 26 semantic boarding pass:** Live Activity and live flight status are **airline only** (`semanticBoardingPass`, `PKTransitTypeAir`). Trains get the classic layout.
- **Poster event tickets** "aren't compatible with tickets that require a QR code or barcode for entry", so they don't suit us.
- **iOS 27 additions:** Poster Generic, Featured Actions, and Apple's Pass Designer (a Mac app) and Pass Builder tools. Nice to have, not needed.
- **NFC:** needs a separate entitlement Apple grants to issuers. Not available to us.

## 5. Fidelity risk
- **Text payloads:** Wallet re-renders the code from `message`. Most ticket payloads are ASCII, and those come out identical. Use `utf-8` only if the text has non-ASCII characters.
- **Binary payloads** (e.g. some rail Aztec codes): map each byte to a character in U+0000–U+00FF and use `iso-8859-1`. In theory that round-trips byte-exact. It is **unverified** for NUL and control bytes and for how Wallet picks the encoding mode.
- **Rendering:** Wallet chooses its own error-correction level, symbol size and quiet zone. The image will look different from the original, but it decodes to the same content.
- **Mitigation:**
  - After building a pass, decode the barcode Wallet renders with our own decoder and compare the bytes.
  - Store the original image as a fallback.
  - Test at a real gate before relying on it. A UK rail forum thread reports pkpass codes that didn't scan (page blocked, unread).

## 6. Plan for our stack
**`POST /api/pkpass`**
- Body: `{payload, payloadEncoding: "text"|"base64", format, title, kind: "train"|"event"|"generic", date, place, seat, from, to}`.
- Builds and signs the pass with passkit-generator from a `train.pass` / `event.pass` / `generic.pass` template (icon and colours).
- Caches the pass for about 5 minutes and returns `{url: "/api/pkpass/<token>.pkpass"}`.
- The client then navigates to that URL with `location.href`.

**`GET /api/pkpass/:token.pkpass`** returns the pass with the correct MIME type.

**Config and secrets:** `PASS_TYPE_ID`, `TEAM_ID`, `SIGNER_CERT_PEM`, `SIGNER_KEY_PEM`, `SIGNER_KEY_PASSPHRASE`, `WWDR_G4_PEM`. Keep them in env or files outside the repo.

**Auth:** the endpoint is a signing service under our Team ID. That's fine behind Tailscale, but it **must** require auth if the server ever becomes public, or Apple could revoke the certificate over abuse.

**Effort:** about 1 day for the endpoint and templates, 0.5 day for device testing (standalone mode, scanning with our decoder), and about 1 hour of account setup (enrollment approval can take a day or two).

```json
{
  "formatVersion": 1,
  "passTypeIdentifier": "pass.example.qrwallet",
  "teamIdentifier": "ABCDE12345",
  "serialNumber": "kippu-7f3c9a",
  "organizationName": "QR Code Wallet",
  "description": "Train ticket Tokyo to Kyoto",
  "backgroundColor": "rgb(0,122,255)", "foregroundColor": "rgb(255,255,255)", "labelColor": "rgb(220,235,255)",
  "relevantDate": "2026-11-20T09:33+09:00",
  "relevantDates": [{ "startDate": "2026-11-20T08:30+09:00", "endDate": "2026-11-20T12:00+09:00" }],
  "locations": [{ "latitude": 35.6812, "longitude": 139.7671, "relevantText": "Tokyo Station" }],
  "barcodes": [{ "format": "PKBarcodeFormatQR", "message": "<decoded payload>", "messageEncoding": "iso-8859-1" }],
  "boardingPass": {
    "transitType": "PKTransitTypeTrain",
    "headerFields": [{ "key": "seat", "label": "CAR / SEAT", "value": "7 / 12A" }],
    "primaryFields": [{ "key": "from", "label": "TOKYO", "value": "TYO" }, { "key": "to", "label": "KYOTO", "value": "KYO" }],
    "secondaryFields": [{ "key": "dep", "label": "DEPARTS", "value": "2026-11-20T09:33+09:00", "dateStyle": "PKDateStyleMedium", "timeStyle": "PKDateStyleShort" }],
    "auxiliaryFields": [{ "key": "train", "label": "TRAIN", "value": "Nozomi 215" }],
    "backFields": [{ "key": "note", "label": "Note", "value": "Personal copy made with QR Code Wallet. Contact: <name, address, phone, email>" }]
  },
  "semantics": {
    "departureStationName": "Tokyo", "destinationStationName": "Kyoto",
    "vehicleNumber": "Nozomi 215", "carNumber": "7",
    "seats": [{ "seatRow": "12", "seatNumber": "A" }],
    "originalDepartureDate": "2026-11-20T09:33+09:00"
  }
}
```

## What we need from the user
1. Enroll in the Apple Developer Program ($99/yr) and send us the **Team ID**.
2. In Identifiers, add a **Pass Type ID** (e.g. `pass.<yourdomain>.qrwallet`).
3. In Certificates, add a **Pass Type ID Certificate**. Upload a CSR made with Keychain Access → Certificate Assistant, or with `openssl req`. Download `pass.cer`.
4. Import it into Keychain and export the certificate plus private key as `.p12` with a password. Convert with `openssl pkcs12 … -legacy` into `signerCert.pem` and `signerKey.pem`. Download the WWDR G4 certificate from apple.com/certificateauthority.
5. Hand the files over securely (not through git). The certificate is valid for about a year and needs a calendar reminder to renew (lifetime unverified). Already-added passes are unaffected by expiry.
6. Decide on branding (name, icon) and confirm the "own brand, no operator logos" policy.

## Sources
- Apple, Building a pass: https://developer.apple.com/documentation/walletpasses/building-a-pass
- Apple, Pass keys: https://developer.apple.com/documentation/walletpasses/pass
- Apple, Barcodes: https://developer.apple.com/documentation/walletpasses/pass/barcodes-data.dictionary
- Apple, Distributing and updating a pass: https://developer.apple.com/documentation/walletpasses/distributing-and-updating-a-pass
- Apple, Semantic boarding passes: https://developer.apple.com/documentation/walletpasses/creating-an-airline-boarding-pass-using-semantic-tags
- Apple, Event passes / poster tickets: https://developer.apple.com/documentation/walletpasses/creating-an-event-pass-using-semantic-tags
- Apple, Semantic tags: https://developer.apple.com/documentation/walletpasses/semantictags
- Apple HIG, Wallet (image sizes): https://developer.apple.com/design/human-interface-guidelines/wallet
- Apple, Add to Apple Wallet guidelines: https://developer.apple.com/wallet/add-to-apple-wallet-guidelines/
- Apple Developer Program License Agreement, Attachment 5: https://developer.apple.com/support/terms/apple-developer-program-license-agreement/
- Apple, Certificate authority (WWDR G4): https://www.apple.com/certificateauthority/
- Apple archive, distributing passes (Safari / Safari View Controller): https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/DistributingPasses.html
- WWDC25 session 202: https://developer.apple.com/videos/play/wwdc2025/202/
- WWDC26 session 209: https://developer.apple.com/videos/play/wwdc2026/209/ and notes at https://wwdcnotes.com/documentation/wwdc26-209-whats-new-in-wallet/
- Apple forums, pkpass in non-Safari browsers: https://developer.apple.com/forums/thread/707131
- MacRumors, Create a Pass in iOS 27: https://www.macrumors.com/how-to/create-a-custom-pass-in-the-wallet-app-on-iphone/
- iDownloadBlog, Create a Pass from photos: https://www.idownloadblog.com/2026/10/01/create-pass-ios-wallet/
- passkit-generator: https://github.com/alexandercerutti/passkit-generator (certificate guide: https://github.com/alexandercerutti/passkit-generator/wiki/Generating-Certificates)
- @walletpass/pass-js: https://github.com/walletpass/pass-js
- WalletWallet: https://walletwallet.alen.ro/
- PassSlot, on certificates: https://www.passslot.com/documentation/passcertificates
- Show HN thread, PassX notes: https://hn.nuxt.dev/item/46345745

## Open questions
- **iOS versions:** iOS 27 is the current release, not iOS 26. It adds the built-in "Create a Pass" flow and four new barcode formats, which partly answers the user's question with no work on our side.
- **Untested claims:**
  - whether the Add-to-Wallet sheet opens from the Home Screen app
  - byte-exact round-tripping of binary payloads
  - the certificate lifetime
  - which formats Create a Pass can read
- **Apple docs pages are rendered with JavaScript.** I read them through Apple's JSON endpoints (`developer.apple.com/tutorials/data/documentation/...json`), so the quoted wording is first-hand.
