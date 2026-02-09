import Foundation

public struct InboxRefreshCoordinator {
    private let syncService: InboxSyncService
    private let scheduler: (any InboxNotificationScheduling)?

    public init(syncService: InboxSyncService, scheduler: (any InboxNotificationScheduling)? = nil) {
        self.syncService = syncService
        self.scheduler = scheduler
    }

    @discardableResult
    public func refresh(page: Int = 1, perPage: Int = 50) async throws -> InboxSyncSnapshot {
        let snapshot = try await syncService.refresh(page: page, perPage: perPage)
        if let scheduler {
            try await scheduler.scheduleDailySummary(newToClassifyCount: snapshot.newToClassifyCount)
        }
        return snapshot
    }
}
