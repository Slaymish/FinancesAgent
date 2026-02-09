import Foundation

public protocol InboxDataProviding: Sendable {
    func fetchInbox(page: Int, perPage: Int) async throws -> InboxResponse
    func fetchInboxStats() async throws -> InboxStatsResponse
}

extension FinanceAgentAPI: InboxDataProviding {}

public protocol InboxMarkerStoring: Sendable {
    func loadMarker() async -> Date?
    func saveMarker(_ marker: Date?) async
}

public actor InMemoryInboxMarkerStore: InboxMarkerStoring {
    private var marker: Date?

    public init(initialMarker: Date? = nil) {
        marker = initialMarker
    }

    public func loadMarker() async -> Date? {
        marker
    }

    public func saveMarker(_ marker: Date?) async {
        self.marker = marker
    }
}

public actor UserDefaultsInboxMarkerStore: InboxMarkerStoring {
    private let defaults: UserDefaults
    private let key: String

    public init(defaults: UserDefaults = .standard, key: String = "finance_agent.inbox_last_seen_imported_at") {
        self.defaults = defaults
        self.key = key
    }

    public func loadMarker() async -> Date? {
        defaults.object(forKey: key) as? Date
    }

    public func saveMarker(_ marker: Date?) async {
        if let marker {
            defaults.set(marker, forKey: key)
        } else {
            defaults.removeObject(forKey: key)
        }
    }
}

public struct InboxSyncSnapshot: Sendable {
    public let fetchedAt: Date
    public let transactions: [InboxTransaction]
    public let stats: InboxStatsResponse
    public let newToClassifyCount: Int
    public let previousMarker: Date?
    public let updatedMarker: Date?
}

public actor InboxSyncService {
    private let provider: any InboxDataProviding
    private let markerStore: any InboxMarkerStoring
    private let now: @Sendable () -> Date

    public init(
        provider: any InboxDataProviding,
        markerStore: any InboxMarkerStoring,
        now: @escaping @Sendable () -> Date = Date.init
    ) {
        self.provider = provider
        self.markerStore = markerStore
        self.now = now
    }

    public func refresh(page: Int = 1, perPage: Int = 50) async throws -> InboxSyncSnapshot {
        async let inboxTask = provider.fetchInbox(page: page, perPage: perPage)
        async let statsTask = provider.fetchInboxStats()

        let inbox = try await inboxTask
        let stats = try await statsTask

        let previousMarker = await markerStore.loadMarker()
        let newToClassifyCount = InboxNotificationCounter.newTransactionsToClassify(
            from: inbox.transactions,
            since: previousMarker
        )
        let updatedMarker = InboxNotificationCounter.updatedMarker(
            from: inbox.transactions,
            existingMarker: previousMarker
        )

        await markerStore.saveMarker(updatedMarker)

        return InboxSyncSnapshot(
            fetchedAt: now(),
            transactions: inbox.transactions,
            stats: stats,
            newToClassifyCount: newToClassifyCount,
            previousMarker: previousMarker,
            updatedMarker: updatedMarker
        )
    }
}
