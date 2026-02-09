# Install On iPhone Without Paid Developer Account

This is a free Apple ID workflow (sideload from Xcode).  
No paid Apple Developer account is required.

## What you can and cannot do on free provisioning

- You can run the app on your own iPhone from Xcode.
- You cannot use TestFlight without a paid Apple Developer Program membership.
- Free signing expires in about 7 days, so you must reconnect and run from Xcode again to re-sign.

## 1. Requirements

- Mac with Xcode installed
- iPhone (iOS 16+ recommended)
- Free Apple ID signed into Xcode
- This repo checked out on the Mac

## 2. Get backend values

You will enter these on first app launch:

- `API Base URL` (for example `https://api.yourdomain.com`)
- `User ID`
- `Internal API Key`
- Optional `Pipeline Token`

Get user IDs:

```bash
pnpm --filter @finance-agent/api users:list
```

Get keys from your deployed environment:

- `INTERNAL_API_KEY`
- `PIPELINE_TOKEN` (optional)

## 3. Create iOS app project in Xcode

1. Open Xcode.
2. `File` -> `New` -> `Project` -> `iOS` -> `App`.
3. Use:
   - Interface: `SwiftUI`
   - Language: `Swift`
   - Deployment target: iOS 16+
4. Save under `apps/ios/FinanceAgentPhone`.

## 4. Add this package as local dependency

1. In project settings, open `Package Dependencies`.
2. Click `+` -> `Add Local...`.
3. Select folder `apps/ios/`.
4. Add product `ios` to your app target.

## 5. Use the provided app entry point

Replace the generated app file with:

- `apps/ios/AppTemplate/FinanceAgentPhoneApp.swift`

This uses:

- `FinanceAgentRootView` for setup + inbox
- Background refresh scaffolding
- Local notification scheduling

## 6. Configure signing for free account

1. Xcode -> `Settings` -> `Accounts` -> add your Apple ID (if not already).
2. In target `Signing & Capabilities`:
   - Check `Automatically manage signing`
   - Set `Team` to your `Personal Team`
   - Set a unique bundle ID, e.g. `com.hamish.financeagent.phone`

## 7. Capabilities and plist

### Background refresh

In `Signing & Capabilities`:

- Add `Background Modes`
- Enable `Background fetch`

In `Info.plist`, add:

- Key: `BGTaskSchedulerPermittedIdentifiers` (Array)
- Item value: `com.financeagent.mobile.inboxrefresh`

### Notifications

No paid entitlement is required for local notifications.

## 8. Prepare iPhone

1. Connect iPhone via cable (or trusted wireless debugging).
2. On iPhone, enable Developer Mode if prompted:
   - `Settings` -> `Privacy & Security` -> `Developer Mode`
3. Trust the Mac if iPhone prompts for trust.

## 9. Install app on iPhone (sideload)

1. Select your iPhone as run destination in Xcode.
2. Press `Run`.
3. If asked, allow Xcode to fix signing/provisioning issues.
4. Open app and fill setup form with:
   - API Base URL
   - User ID
   - Internal API Key
   - Pipeline Token (optional)
5. Allow notifications when prompted.

## 10. Reinstall cadence (free account)

- App signature typically expires after ~7 days.
- Reconnect iPhone and press `Run` again to renew.

## 11. Liquid Glass note

- The UI now uses the SwiftUI Liquid Glass API on iOS 26+ (with fallback material style on earlier iOS versions).
- To see native Liquid Glass, build with an iOS 26-capable Xcode SDK and run on iOS 26.
