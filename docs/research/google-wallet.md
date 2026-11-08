# Google Wallet passes from QR Code Wallet (research, 2026-11-08)

## TL;DR

- **It's feasible and free.** Google documents no API fees. Effort is about 1 day of code plus a couple of hours of console setup.
- **Use a Generic pass.** It's Google's catch-all type, and its `genericType` list includes `GENERIC_ENTRY_TICKET`. It supports QR, Aztec, PDF417 and Code128, plus validity windows and "upcoming" notifications.
- **The JWT must be signed on our server.** A Node endpoint signs it (RS256) with a service-account key and returns `https://pay.google.com/gp/v/save/<jwt>`.
- **Demo mode may be enough for personal use.** Without publishing access, only the account's admins/developers and test accounts can save passes, and each pass is tagged "[TEST ONLY]". Opening it to everyone needs a Business Profile and Google's review.
- **There is no Google Wallet app on iPhone.** iOS users only get wallet.google.com in Safari. For iPhone the real target is Apple Wallet `.pkpass`, which is a separate piece of work.
- **Google Wallet can already make passes from photos ("Everything else", Aug 2024).** It works, but it's manual, it reads the image again (OCR), and there's no documented deep link into it. Our integration gives the exact payload, structured fields and notifications.
- **Biggest open risk: byte-exact binary barcodes.** `barcode.value` is a string and there is no encoding field for binary data. Text QR codes are fine. Binary Aztec codes (e.g. European UIC rail tickets) need testing.

## 1. Pass types

| Type | Fit |
|---|---|
| **Generic** | Best fit. Free-form title, header, text modules. `genericType` includes `GENERIC_ENTRY_TICKET`. |
| Event ticket | Possible, but needs an event/venue structure we don't really have. |
| Flight / Transit | Need many structured fields (carrier, airports, trip type). Too heavy for codes users saved themselves. |
| Generic **Private** | Only for sensitive data (IDs, health cards). Needs explicit permission from Google and documents. Not us. |

**GenericObject**
- **Required fields:** `id` (`issuerId.suffix`), `classId`, `cardTitle`, `header`.
- **Optional fields:** `subheader`, `logo`, `heroImage`, `hexBackgroundColor`, `barcode`, `validTimeInterval` (the pass shows as expired after it), `textModulesData` (up to 10), `notifications`.
- **Notifications:** `upcomingNotification` fires 1 day before the pass becomes valid. `expiryNotification` fires 2 days before it expires. If both are set, expiry wins.
- **Fallbacks:** if there's no logo, Wallet shows the first letter of `cardTitle`. If there's no color, it takes the dominant color of the hero image or logo.
- **Barcode types:** `QR_CODE`, `AZTEC`, `PDF_417`, `CODE_128`, `DATA_MATRIX`, `CODE_39`, `EAN_8`/`EAN_13`, `UPC_A`, `ITF_14`, `CODABAR`, `TEXT_ONLY`. All four of our formats are covered.
- **Barcode fields:** `alternateText` is the human-readable text under the code. `renderEncoding` has only one option, `UTF_8`, and it works for QR only.
- **Images:** they are fetched by Google, so they must be at **public HTTPS URLs**. Our Tailscale host won't work for that. Either skip the logo or host a static one somewhere public.

## 2. Requirements and policy

1. Create an issuer account in the Google Pay & Wallet Console. This gives us the issuer ID, and the account starts in demo mode.
2. Create a Google Cloud project, enable the Wallet API, create a service account and a JSON key, and add the service account as a user in the Wallet console.
3. **Publishing access (optional):** fill in the Business Profile (business details plus a payments profile), then click "Request publishing access". Google checks that the account belongs to a real business, organization or individual. No timeline is given, and screenshots are no longer required.

**Policy**
- The API terms make us "solely responsible to Google for any content submitted". Aggregators must be "authorized by such third parties" whose brand features they submit.
- The Acceptable Use Policy bans counterfeits: logos "identical to or substantially indistinguishable from" another company's mark.
- **Rule for us:** issue under our own brand and never use provider logos. Writing the provider's name as plain text (e.g. "Tokaido Shinkansen") is lower risk, but I couldn't find an explicit rule on it, so it's still open.
- **Precedent:** WalletWallet (a web tool) and Pass2U (an app) already issue Google Wallet passes from barcodes that users entered, under their own issuer accounts. Catima and Stocard don't appear to offer Google Wallet export (not verified).

## 3. Delivering it from the web app

- **Fat JWT:** the class and object are embedded in the JWT and get created when the user saves. **Skinny JWT:** we insert the object via the REST API first, and the JWT only carries `{id, classId}`.
- **Length limit:** Google says to keep the JWT under **1800 characters**, because browsers may truncate longer links. The RS256 signature alone takes about 342 characters. With a long payload a fat JWT will overflow, so skinny is the robust option.
- **Key handling:** the key never goes to the client.
- **Button:** use only Google's official assets, unmodified. Minimum 48dp tall with 8dp clear space, black only, localized versions where available.
- **`origins` claim:** only needed for the JS-rendered button. A plain link or `location.href` doesn't need it.
- **Android:** the link should hand off to the Wallet save sheet, including from a standalone PWA. This is unverified on our setup and needs a test.
- **iOS / desktop:** the link presumably saves to the Google account via a web flow, and the pass is then viewable at wallet.google.com. This is also unverified.

## 4. "Everything else" (Wallet's own photo passes)

- Launched in August 2024, US-only at first. The help page now says it's unavailable in India, and no country list is published.
- Since June 2025 Wallet can appear as a target in the Android image share sheet (gradual rollout).
- **What we could do:** share a rendered PNG of the code via the Web Share API. That reaches it with zero setup, but it's manual and depends on Wallet re-reading the image.
- Wallet can also open `.pkpass` files on Android (since 2024).
- It doesn't make our integration pointless: we get the exact payload, dates and notifications. It is a good no-backend fallback.

## 5. Fidelity

- `value` is a JSON string, and Google has no equivalent of Apple's `messageEncoding`.
- **Text payloads are safe:** ASCII/UTF-8 QR codes, airline PDF417, Code128.
- **Binary payloads are uncertain:** zlib-compressed Aztec codes (UIC 918.3/918.9 rail tickets) or non-UTF-8 QR codes. How bytes above 0x7F get rendered is undocumented.
- **Mitigation:**
  - Flag binary payloads in the app.
  - Test by re-scanning Wallet's render and comparing bytes.
  - If the bytes don't match, fall back to the screenshot/photo path.
  - A 2026 blog post reports that browsers forcing dark mode can break barcodes shown on wallet.google.com.

## 6. Implementation plan

**Endpoint:** `POST /api/gwallet` with `{id, title, payload, format, start, end, place, seat}` returns `{saveUrl}`.
1. Map our formats to `QR_CODE`, `AZTEC`, `PDF_417` and `CODE_128`.
2. Object id is `${ISSUER_ID}.${sha256(id+payload).slice(0,32)}`, so an edited ticket gets a new object. I haven't checked whether re-saving an existing id through a JWT updates it.
3. Use one class, `${ISSUER_ID}.qrwallet_v1`, created once by a setup script.
4. Insert the object via the REST API (`google-auth-library`), then sign a skinny JWT with `jsonwebtoken` (RS256).

**Config:**
- `GWALLET_ISSUER_ID`
- `GWALLET_SA_KEY_PATH` (outside the repo, `chmod 600`)
- optional public `GWALLET_LOGO_URL`

**Minimal fat-JWT payload** (Shinkansen example):

```json
{
  "iss": "wallet-signer@PROJECT.iam.gserviceaccount.com",
  "aud": "google", "typ": "savetowallet", "iat": 1763600000, "origins": [],
  "payload": {
    "genericClasses": [{ "id": "ISSUER_ID.qrwallet_v1" }],
    "genericObjects": [{
      "id": "ISSUER_ID.tkt_8f3a2c91",
      "classId": "ISSUER_ID.qrwallet_v1",
      "state": "ACTIVE",
      "genericType": "GENERIC_ENTRY_TICKET",
      "cardTitle": { "defaultValue": { "language": "en", "value": "QR Code Wallet" } },
      "subheader": { "defaultValue": { "language": "en", "value": "Tokaido Shinkansen" } },
      "header":    { "defaultValue": { "language": "en", "value": "Nozomi 21 · Tokyo → Kyoto" } },
      "hexBackgroundColor": "#007AFF",
      "validTimeInterval": {
        "start": { "date": "2026-11-20T09:00:00+09:00" },
        "end":   { "date": "2026-11-20T11:30:00+09:00" } },
      "notifications": { "upcomingNotification": { "enableNotification": true } },
      "textModulesData": [{ "id": "seat", "header": "Seat", "body": "Car 7, 12D" }],
      "barcode": { "type": "QR_CODE", "value": "<decoded payload, verbatim>", "alternateText": "Car 7 · 12D" }
    }]
  }
}
```

**Effort estimate:**
- Console and Cloud setup: about 2h.
- Endpoint plus setup script: about 4h.
- UI button and Web Share fallback: about 2h.
- Device testing (Android and iOS web, re-scanning each format): about 2h.

**What we need from the user:**
1. A Google account to own the issuer account, and their **issuer ID**.
2. A Cloud project with a **service-account JSON key** (placed on the server, not committed).
3. The Gmail addresses of anyone who should save passes in demo mode, to add as test accounts.
4. A decision: is demo mode ("[TEST ONLY]") enough, or do we fill in the Business Profile and request publishing access?
5. Optionally, a public URL for the logo.
6. A sample of each real ticket type, especially binary Aztec rail tickets, for the fidelity test.

**Open questions:** Wallet country availability, any cap on test accounts (none documented), and how the save link behaves on iOS and in the PWA.

## Sources

- Generic pass overview: https://developers.google.com/wallet/generic
- GenericObject reference: https://developers.google.com/wallet/reference/rest/v1/genericobject
- BarcodeType: https://developers.google.com/wallet/reference/rest/v1/BarcodeType
- Barcode: https://developers.google.com/wallet/reference/rest/v1/Barcode
- BarcodeRenderEncoding: https://developers.google.com/wallet/reference/rest/v1/BarcodeRenderEncoding
- JWT format: https://developers.google.com/wallet/reference/rest/v1/Jwt
- Working with JWTs: https://developers.google.com/wallet/generic/use-cases/jwt
- Issuing from the web: https://developers.google.com/wallet/generic/web
- Publishing access: https://developers.google.com/wallet/generic/getting-started/request-publishing-access
- Issuer onboarding: https://developers.google.com/pay-wallet/products/wallet/generic/getting-started/issuer-onboarding
- Generic private pass: https://developers.google.com/wallet/generic-private-pass
- Brand guidelines: https://developers.google.com/wallet/generic/resources/brand-guidelines
- Terms of Service: https://developers.google.com/wallet/terms-of-service
- Acceptable Use Policy: https://payments.developers.google.com/terms/aup
- Release notes: https://developers.google.com/wallet/docs/release-notes
- Wallet help (manage items, photo passes): https://support.google.com/wallet/answer/12060038
- "Everything else" launch: https://9to5google.com/2024/08/12/google-wallet-everything-else/
- Share-sheet target: https://www.androidauthority.com/google-wallet-share-sheet-target-3571085
- `.pkpass` support on Android: https://9to5google.com/2024/04/04/google-wallet-apple-wallet-pass-files-how/
- iOS status (APK teardown, no iOS app): https://androidauthority.com/google-wallet-iphone-apk-teardown-3710795
- Wallet web expansion: https://9to5google.com/2024/07/09/google-wallet-web-more-countries/
- Dark-mode barcode issue: https://blog.yuo.be/2026/05/22/google-wallet-barcodes-self-service-checkouts-and-feeling-incompetent/
- WalletWallet: https://walletwallet.alen.ro/blog/create-apple-wallet-pass-free/
- Pass2U: https://www.idownloadblog.com/?p=450768

---

Notes on how solid this is:
- **Unconfirmed or untested:** the iOS state comes from secondary 2026 reporting only (no current Google statement found). "Free" means no fees are documented, not that Google says so explicitly. The PWA/iOS save-link behaviour and binary-barcode rendering are untested.
- **Not loaded:** some Android Authority pages and Google's pass-converter repo wouldn't load, so I relied on search excerpts for those.
- **Not covered:** Apple Wallet `.pkpass` for iPhone users is mentioned but not researched here.
