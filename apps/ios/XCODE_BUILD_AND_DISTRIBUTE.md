# Build In Xcode And Install On iPhone

This guide is for private testing only (sideloading or TestFlight internal testing).

## 1. Prerequisites

- Mac with latest Xcode
- iPhone connected to your Mac
- Apple ID signed into Xcode
- For TestFlight: paid Apple Developer account and App Store Connect access

## 2. Prepare backend values

You need these values for the in-app setup screen:

- `API Base URL` (for example `https://api.yourdomain.com`)
- `User ID`
- `Internal API Key`
- Optional `Pipeline Token`

Get user IDs from your local repo:

```bash
pnpm --filter @finance-agent/api users:list
```

Read keys from your deployed API/web `.env`:

- `INTERNAL_API_KEY`
- `PIPELINE_TOKEN` (optional)

## 3. Create iOS app target in Xcode

1. Open Xcode.
2. Create a new project: `iOS` -> `App` -> `SwiftUI`.
3. Recommended:
   - Deployment target: iOS 16+
   - Interface: SwiftUI
   - Language: Swift
4. Save the project under `apps/ios/FinanceAgentPhone`.

## 4. Add local package dependency

1. In Xcode: project -> `Package Dependencies` -> `+`.
2. Choose `Add Local...`.
3. Select folder: `apps/ios/`.
4. Add product: `ios`.

## 5. Use provided App template

Replace the generated app file with:

- `apps/ios/AppTemplate/FinanceAgentPhoneApp.swift`

That app entry point uses:

- `FinanceAgentRootView` for first-run setup
- `InboxDashboardView` for inbox UI
- optional background refresh registration

## 6. Xcode capabilities and plist

### Signing

- Target -> `Signing & Capabilities`:
  - Team: your Apple account/team
  - Bundle identifier: unique (example `com.hamish.financeagent.mobile`)

### Background refresh

- Add capability: `Background Modes`
- Enable: `Background fetch`

- In `Info.plist`, add:
  - `BGTaskSchedulerPermittedIdentifiers` (Array)
  - Value: `com.financeagent.mobile.inboxrefresh`

### Notifications

No extra entitlement is required for local notifications.

## 7. Run on phone (sideload)

1. Select your iPhone as run destination.
2. Build and run from Xcode.
3. On first launch, fill the setup form:
   - API Base URL
   - User ID
   - Internal API Key
   - Pipeline Token (optional)
4. Grant notification permission when prompted.

If using plain HTTP API for testing, configure App Transport Security exceptions in `Info.plist` or use HTTPS.

## 8. TestFlight (private only)

1. In Xcode, set version and build number.
2. `Product` -> `Archive`.
3. In Organizer, upload to App Store Connect.
4. In App Store Connect:
   - Create app record (if first upload)
   - Add build to internal testing group
   - Invite Apple IDs (or yourself)
5. Install from TestFlight on iPhone.

No public App Store release is required.

## 9. Recommended hardening before wider use

- Do not ship long-lived `INTERNAL_API_KEY` to a broad audience.
- For production-grade mobile auth, add user-scoped short-lived mobile tokens on the API side and store them in Keychain.
