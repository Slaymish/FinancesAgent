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
  - `confirmInboxTransaction(id:categoryId:categoryType:)`
- Added `InboxNotificationCounter` helper for "new transactions since last marker" logic
- Added inbox refresh pipeline in `Sources/ios/InboxSyncService.swift`
  - `InboxSyncService` fetches inbox + stats concurrently
  - Persists last-seen imported marker
  - Returns `newToClassifyCount` for notifications
- Added notification scaffolding in `Sources/ios/InboxNotifications.swift`
  - Cross-platform payload builder
  - iOS `UNUserNotificationCenter` scheduler implementation
- Added coordinator in `Sources/ios/InboxRefreshCoordinator.swift` to connect refresh + notifications
- Added iOS-only SwiftUI dashboard view scaffold in `Sources/ios/InboxDashboardView.swift`
- Added tests in `Tests/iosTests/iosTests.swift` for decoding + notification count behavior

## Next build target

- Add an `App` target (Xcode project) that wires:
  - Auth/session source into `FinanceAgentAPIConfiguration`
  - `InboxRefreshCoordinator` into app lifecycle refreshes
  - `InboxDashboardView` with confirm actions and refresh state
