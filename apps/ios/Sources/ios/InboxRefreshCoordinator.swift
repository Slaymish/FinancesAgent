import Foundation

public struct InboxRefreshCoordinator {
    private let syncService: InboxSyncService
    private let scheduler: (any InboxNotificationScheduling)?
    private let refreshStateStore: (any InboxRefreshStateStoring)?

    public init(
        syncService: InboxSyncService,
        scheduler: (any InboxNotificationScheduling)? = nil,
        refreshStateStore: (any InboxRefreshStateStoring)? = nil
    ) {
        self.syncService = syncService
        self.scheduler = scheduler
        self.refreshStateStore = refreshStateStore
    }

    @discardableResult
    public func refresh(page: Int = 1, perPage: Int = 50) async throws -> InboxSyncSnapshot {
        let snapshot = try await syncService.refresh(page: page, perPage: perPage)

        let previousObservedCount = if let refreshStateStore {
            await refreshStateStore.loadLastObservedNewCount()
        } else {
            0
        }

        if let scheduler {
            let shouldNotify = snapshot.newToClassifyCount > 0 && snapshot.newToClassifyCount > previousObservedCount
            if shouldNotify {
                try await scheduler.scheduleDailySummary(newToClassifyCount: snapshot.newToClassifyCount)
            }
        }

        if let refreshStateStore {
            await refreshStateStore.saveLastObservedNewCount(snapshot.newToClassifyCount)
        }

        return snapshot
    }
}
