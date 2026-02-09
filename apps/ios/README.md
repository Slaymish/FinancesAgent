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
- Added tests in `Tests/iosTests/iosTests.swift` for decoding + notification count behavior

## Next build target

- Add SwiftUI app shell with:
  - Inbox list view (pulling from `FinanceAgentAPI`)
  - Swipe actions for confirm/category
  - Streak + stats cards
  - Local persisted marker + daily local notification scheduling for new-to-clear transactions
