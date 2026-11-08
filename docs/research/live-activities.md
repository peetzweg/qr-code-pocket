# Live Activities for QR Code Wallet (research, 2026-11-08)

## TL;DR

- **Only native apps can create Live Activities.** You need ActivityKit plus a WidgetKit extension. A PWA, Safari, web push, a Wallet pass or Shortcuts cannot start one directly. I found no web API for it, and that remains true through iOS 27.
- **Since iOS 26 a native app can schedule a Live Activity for a future date with no backend.** The system starts it on time even if the app is in the background. That fits a "next ticket" countdown well.
- **Wallet passes get Lock Screen relevance, not a Live Activity.** The Wallet-driven Live Activity in iOS 26 is limited to *airline* boarding passes that use semantic tags. A Shinkansen or museum pass we generate would only get the old "relevant pass on the Lock Screen" treatment.
- **Suggested path:** keep the PWA. Optionally add signed `.pkpass` export, then build a small native companion app if the Live Activity is worth it.

## 1. What Live Activities are

- **Where they show up:** Lock Screen, Dynamic Island, StandBy (Lock Screen view scaled to 2x), Apple Watch Smart Stack, the Mac menu bar (tapping opens iPhone Mirroring) and the CarPlay Dashboard. All of this is fact from Apple's docs and WWDC26 session 223.
  - **Recent changes:** iOS 27 adds a landscape Dynamic Island. Docs list native macOS / Mac Catalyst ActivityKit as **27.3 beta**. Docs also say iPhone 18 Pro shows two compact activities at once.
- **Duration:** an activity can be active for up to 8 hours. After that it can stay on the Lock Screen for up to 4 more hours, so 12 hours maximum.
- **Size:** static and dynamic data together can't exceed **4 KB**, and the same applies to each update.
- **No network or location:** the activity itself can't fetch anything. Only the app (via ActivityKit) or APNs pushes can update it.
- **Images:** the resolution must be at or below the presentation size, or the activity may fail to start. The Lock Screen view is about 371–408 pt wide and 84–160 pt tall on iPhone.
- **Countdown:** `Text(timerInterval:)` and date-style timers tick on their own without any updates.
- **Update budget:** pushes at priority 10 count against an hourly budget. Priority 5 pushes don't count. Apps can opt into frequent updates.
- **Content rules (HIG):** no ads. Avoid sensitive information, because the Lock Screen and Always-On display are visible to anyone nearby. Tapping should deep-link to the right screen. App Intent buttons are allowed, but they don't work in CarPlay.
- **Can it show a QR code?** Technically a ~160 pt QR image fits. My inference: it is a poor fit, because the HIG warns about sensitive content and scanning a dimmed Lock Screen is unreliable. A better design is "tap to open the code full screen".

## 2. Who can create them

- **Native apps only.** The app calls `Activity.request` while in the foreground. From the background it can only start one through a `LiveActivityIntent` (App Intents). That means **Shortcuts and automations can trigger it, but only through our own native app's intent**.
- **Scheduled start (iOS 26+):** `request(attributes:content:pushType:style:alertConfiguration:start:)`. An `AlertConfiguration` is required, and scheduled activities count toward the device's limit.
- **Push-to-start (iOS 17.2+):** the app gets a `pushToStartToken` and a server starts the activity through APNs, without the user opening the app. iOS 18 added starting into a token or a channel.
- **Broadcast channels (iOS 18):** update or end many activities at once over a channel. Channels **cannot start** an activity.
- **Web / PWA:** I found no mechanism. ActivityKit push tokens can't come from the User Notifications framework, let alone web push, so web push can't drive one. This is an inference from the docs; I found no explicit Apple statement either way. A PWA can send ordinary web push notifications on iOS 16.4+ when installed to the Home Screen.

## 3. Wallet passes

- **Lock Screen relevance:** a pass shows on the Lock Screen at a relevant time or place. This is driven by `relevantDates` (date ranges, iOS 18+, replacing the deprecated `relevantDate`), up to 10 `locations`, and iBeacons. This works for boarding passes, including `PKTransitTypeTrain`, event tickets and generic passes.
- **iOS 26 semantic boarding passes:** Wallet shows live flight status, gate changes, Share Flight Tracker and a **Wallet-based Live Activity**. Requirements: `semanticBoardingPass` in `preferredStyleSchemes`, `PKTransitTypeAir`, and the required semantic tags. Apple says to use this style *only for airline boarding passes*. Airlines can suppress Wallet's Live Activity in favour of their own app's.
- **For us:** a train, museum or restaurant pass gets relevance, not a Live Activity. Passes must also be signed with an Apple Pass Type ID certificate, which requires a paid developer account. My inference: signing has to happen on a server or in a local tool, because putting the private key in the PWA would expose it.

## 4. Minimal native companion app

- **Pieces:** a SwiftUI app plus a WidgetKit extension with an `ActivityConfiguration`. Lock Screen and Dynamic Island views go in `DynamicIsland` regions. Add `NSSupportsLiveActivities` to Info.plist and an App Group to share ticket data and QR images.
- **Data model:**
  - `ActivityAttributes`: ticket ID, title, departure date, platform, seat.
  - `ContentState`: status or delay.
  - Countdown: `Text(timerInterval: now...departure)`.
- **Lifecycle:**
  - Schedule each ticket with `start:` a few hours before departure, staying inside the 8-hour limit.
  - Set `staleDate` to the departure time.
  - End with `dismissalPolicy: .after(...)` (the HIG suggests 15–30 minutes).
- **Tap behaviour:** `widgetURL` pointing at `qrwallet://ticket/<id>` opens the code full screen.
- **Backend:** not needed for local start, update and end. Only needed for remote changes (delays) or push-to-start.
- **Alternative:** a WidgetKit Home Screen or Lock Screen widget with a timeline of "next ticket" entries. It has no 8-hour limit and doesn't need ActivityKit, but it is less prominent.
- **Distribution:** TestFlight and the App Store need the Apple Developer Program ($99/yr).

## 5. Apps doing it well

- **United:** Lock Screen and Dynamic Island show gate, seat and a departure countdown, and tapping opens the boarding pass (2023 launch coverage, so I couldn't confirm it still works the same way). This is the closest match to our idea.
- **Flighty:** detailed flight Live Activities.
- **Citymapper:** step-by-step transit progress.
- **Train Island:** Singapore MRT stops remaining.
- **Apple Wallet itself:** iOS 26 semantic boarding passes.
- Uber-style ride tracking and sports scores are the standard examples, and Apple's docs use sports matches as the canonical scheduling case. I didn't check sources for these two.

## 6. Recommendation

| Capability | PWA today | Native app |
|---|---|---|
| Live Activity / Dynamic Island | No | Yes (scheduled, no server) |
| Lock Screen surfacing | Via generated `.pkpass` relevance | Yes |
| Alerts | Web push (needs a server) | Local notifications |
| Home / Lock Screen widget | No | Yes |

**Path:**
1. Keep the PWA as the source of truth.
2. Optionally add "Add to Apple Wallet" export, which needs a small signing service. That gets time- and place-relevant Lock Screen surfacing without a native app.
3. If we want the countdown on the Lock Screen and in the Dynamic Island, build a thin SwiftUI companion app. It would import tickets (share sheet or URL scheme), schedule one Live Activity per upcoming ticket with `start:`, and deep-link to a full-screen code. No backend is needed.

## Sources

- Displaying live data with Live Activities: https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities
- `request(…start:)` (iOS 26): https://developer.apple.com/documentation/activitykit/activity/request(attributes:content:pushtype:style:alertconfiguration:start:)
- ActivityKit push notifications (push-to-start, channels, budgets): https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications
- HIG, Live Activities (sizes, content rules, Mac, Watch): https://developer.apple.com/design/human-interface-guidelines/live-activities
- WWDC26 "Live Activities essentials": https://developer.apple.com/videos/play/wwdc2026/223/
- Creating an airline boarding pass using semantic tags: https://developer.apple.com/documentation/walletpasses/creating-an-airline-boarding-pass-using-semantic-tags
- Showing a pass on the Lock Screen: https://developer.apple.com/documentation/walletpasses/showing-a-pass-on-the-lock-screen
- Pass keys / `relevantDates`: https://developer.apple.com/documentation/walletpasses/pass
- Apple forum on the boarding pass Live Activity: https://developer.apple.com/forums/thread/788338
- Airship, boarding pass semantics: https://www.airship.com/docs/guides/wallet/user-guide/boarding-pass-semantics/
- MacRumors, United Live Activities: https://www.macrumors.com/2023/05/25/united-airlines-live-activities/
- iMore, United: https://www.imore.com/apps/united-airlines-becomes-the-first-airline-to-support-live-activities-heres-what-it-does
- Citymapper: https://content.citymapper.com/i/2553/citymapper-introduces-ios-lock-screen-navigation
- Train Island: https://apps.apple.com/us/app/-/id6443865952
