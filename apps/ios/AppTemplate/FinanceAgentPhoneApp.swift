import SwiftUI
import ios

@main
struct FinanceAgentPhoneApp: App {
    @State private var hasConfiguredBackgroundRefresh = false

    var body: some Scene {
        WindowGroup {
            FinanceAgentRootView()
                .task {
                    await configureBackgroundRefreshIfPossible()
                }
        }
    }

    private func configureBackgroundRefreshIfPossible() async {
        guard !hasConfiguredBackgroundRefresh else { return }
        hasConfiguredBackgroundRefresh = true

        #if canImport(BackgroundTasks)
        guard let session = await UserDefaultsMobileSessionStore().load() else {
            return
        }

        let api = FinanceAgentAPI(configuration: session.asAPIConfiguration())
        let markerStore = UserDefaultsInboxMarkerStore()
        let syncService = InboxSyncService(provider: api, markerStore: markerStore)
        let refreshStateStore = UserDefaultsInboxRefreshStateStore()

        let scheduler: (any InboxNotificationScheduling)? = {
            #if canImport(UserNotifications)
            return IOSInboxNotificationScheduler()
            #else
            return nil
            #endif
        }()

        let coordinator = InboxRefreshCoordinator(
            syncService: syncService,
            scheduler: scheduler,
            refreshStateStore: refreshStateStore
        )

        let manager = InboxBackgroundRefreshManager(
            taskIdentifier: "com.financeagent.mobile.inboxrefresh",
            coordinator: coordinator
        )
        await manager.register()
        await manager.scheduleNext()
        #endif
    }
}
