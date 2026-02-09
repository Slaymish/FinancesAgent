# IOS App

- Using Swift, native ios app. Code developed on linux, when ready to build, I will pull repo on mac and build/deploy from there.
- Designed to use liquid glass
- Mainly display most content from web page, primary use/focus being inbox page
    - Include streak counter, swipe actions, etc
- Get daily notifications like 'Theres x new transactions to clasify!'
    - Should stick with only *new* transactions, not all time unclasified, to not overwealm user.


## Current ios codebase

- Used `swift package init` in `apps/ios/`

## Implemented in this pass

- Added typed inbox API models in `Sources/ios/Models.swift`
- Added `FinanceAgentAPI` networking client in `Sources/ios/FinanceAgentAPI.swift`
  - `fetchInbox(page:perPage:)`
  - `fetchInboxStats()`
  - `fetchTransactionCategories()`
  - `confirmInboxTransaction(id:categoryId:categoryType:)`
- Added `InboxNotificationCounter` helper for "new transactions since last marker" logic
- Added inbox refresh pipeline in `Sources/ios/InboxSyncService.swift`
  - `InboxSyncService` fetches inbox + stats concurrently
  - Persists last-seen imported marker
  - Returns `newToClassifyCount` for notifications
- Added notification scaffolding in `Sources/ios/InboxNotifications.swift`
  - Cross-platform payload builder
  - iOS `UNUserNotificationCenter` scheduler implementation
- Added refresh-state policy store so notifications only fire when new-to-classify count increases from prior refresh
- Added coordinator in `Sources/ios/InboxRefreshCoordinator.swift` to connect refresh + notifications + policy state
- Added background refresh manager scaffold in `Sources/ios/InboxBackgroundRefresh.swift`
- Added persisted mobile session model/store in `Sources/ios/MobileSession.swift`
- Added app-facing SwiftUI view model in `Sources/ios/InboxAppViewModel.swift`
- Added `FinanceAgentRootView` setup + inbox runtime wiring in `Sources/ios/FinanceAgentRootView.swift`
- Added iOS-only SwiftUI inbox dashboard with category editing + optimistic confirm in `Sources/ios/InboxDashboardView.swift`
- Added `LiquidGlassStyle` helper modifiers in `Sources/ios/LiquidGlassStyle.swift`
  - Uses SwiftUI Liquid Glass on iOS 26+
  - Falls back to material cards on earlier iOS
- Added Xcode app entry template in `AppTemplate/FinanceAgentPhoneApp.swift`
- Added free-Apple-ID sideload guide in `XCODE_BUILD_AND_DISTRIBUTE.md`
- Added tests in `Tests/iosTests/iosTests.swift` for decoding, refresh behavior, and notification policy

## Next build target

- On Mac, create/open the iOS app target in Xcode and drop in `AppTemplate/FinanceAgentPhoneApp.swift`.
- Follow `XCODE_BUILD_AND_DISTRIBUTE.md` for free provisioning signing and install on device.
