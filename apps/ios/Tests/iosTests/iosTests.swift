import Foundation
import Testing
@testable import ios

actor StubInboxProvider: InboxDataProviding {
    let inbox: InboxResponse
    let stats: InboxStatsResponse

    init(inbox: InboxResponse, stats: InboxStatsResponse) {
        self.inbox = inbox
        self.stats = stats
    }

    func fetchInbox(page: Int, perPage: Int) async throws -> InboxResponse {
        inbox
    }

    func fetchInboxStats() async throws -> InboxStatsResponse {
        stats
    }
}

actor RecordingScheduler: InboxNotificationScheduling {
    private(set) var lastCount: Int?

    func scheduleDailySummary(newToClassifyCount: Int) async throws {
        lastCount = newToClassifyCount
    }

    func readLastCount() async -> Int? {
        lastCount
    }
}

@Test func decodesInboxResponseWithImportedAt() throws {
    let json = """
    {
      "ok": true,
      "transactions": [
        {
          "id": "txn_1",
          "date": "2026-02-09T00:00:00.000Z",
          "merchantName": "Employer Ltd",
          "descriptionRaw": "Salary",
          "amount": 4200,
          "category": "Salary",
          "inboxState": "needs_review",
          "suggestedCategoryId": "Salary",
          "confidence": 0.91,
          "importedAt": "2026-02-09T00:05:00.000Z"
        }
      ],
      "pagination": {
        "page": 1,
        "perPage": 50,
        "total": 1,
        "totalPages": 1
      }
    }
    """

    let data = Data(json.utf8)
    let decoded = try FinanceAgentCoders.decoder.decode(InboxResponse.self, from: data)

    #expect(decoded.ok)
    #expect(decoded.transactions.count == 1)
    #expect(decoded.transactions[0].merchantName == "Employer Ltd")
    #expect(decoded.transactions[0].importedAt != nil)
}

@Test func countsOnlyNewTransactionsForNotifications() {
    let oldDate = Date(timeIntervalSince1970: 1_700_000_000)
    let newDate = oldDate.addingTimeInterval(3600)

    let oldTransaction = InboxTransaction(
        id: "old",
        date: oldDate,
        merchantName: "Old Merchant",
        descriptionRaw: "Old",
        amount: -10,
        category: "Groceries",
        inboxState: "needs_review",
        suggestedCategoryId: "Groceries",
        confidence: 0.4,
        importedAt: oldDate
    )

    let newTransaction = InboxTransaction(
        id: "new",
        date: newDate,
        merchantName: "New Merchant",
        descriptionRaw: "New",
        amount: -20,
        category: "Transport",
        inboxState: "unclassified",
        suggestedCategoryId: "Transport",
        confidence: 0.2,
        importedAt: newDate
    )

    let count = InboxNotificationCounter.newTransactionsToClassify(
        from: [oldTransaction, newTransaction],
        since: oldDate
    )

    #expect(count == 1)
}

@Test func markerMovesForwardOnly() {
    let marker = Date(timeIntervalSince1970: 1_700_000_000)
    let older = marker.addingTimeInterval(-100)
    let newer = marker.addingTimeInterval(200)

    let transactions = [
        InboxTransaction(
            id: "older",
            date: older,
            merchantName: "Older",
            descriptionRaw: "Older",
            amount: -1,
            category: "Test",
            inboxState: "needs_review",
            suggestedCategoryId: nil,
            confidence: nil,
            importedAt: older
        ),
        InboxTransaction(
            id: "newer",
            date: newer,
            merchantName: "Newer",
            descriptionRaw: "Newer",
            amount: -1,
            category: "Test",
            inboxState: "needs_review",
            suggestedCategoryId: nil,
            confidence: nil,
            importedAt: newer
        )
    ]

    let updated = InboxNotificationCounter.updatedMarker(from: transactions, existingMarker: marker)

    #expect(updated == newer)
}

@Test func syncServiceComputesAndPersistsNewCount() async throws {
    let oldDate = Date(timeIntervalSince1970: 1_700_000_000)
    let newDate = oldDate.addingTimeInterval(3600)

    let transactions = [
        InboxTransaction(
            id: "t1",
            date: oldDate,
            merchantName: "Old",
            descriptionRaw: "Old",
            amount: -10,
            category: "Groceries",
            inboxState: "needs_review",
            suggestedCategoryId: nil,
            confidence: nil,
            importedAt: oldDate
        ),
        InboxTransaction(
            id: "t2",
            date: newDate,
            merchantName: "New",
            descriptionRaw: "New",
            amount: -20,
            category: "Transport",
            inboxState: "needs_review",
            suggestedCategoryId: nil,
            confidence: nil,
            importedAt: newDate
        )
    ]

    let provider = StubInboxProvider(
        inbox: InboxResponse(
            ok: true,
            transactions: transactions,
            pagination: InboxPagination(page: 1, perPage: 50, total: 2, totalPages: 1)
        ),
        stats: InboxStatsResponse(ok: true, toClearCount: 2, streak: 3, autoClassifiedPercent: 50)
    )
    let markerStore = InMemoryInboxMarkerStore(initialMarker: oldDate)
    let service = InboxSyncService(provider: provider, markerStore: markerStore, now: { newDate })

    let snapshot = try await service.refresh()

    #expect(snapshot.newToClassifyCount == 1)
    #expect(snapshot.previousMarker == oldDate)
    #expect(snapshot.updatedMarker == newDate)

    let storedMarker = await markerStore.loadMarker()
    #expect(storedMarker == newDate)
}

@Test func refreshCoordinatorPassesNewCountToScheduler() async throws {
    let now = Date(timeIntervalSince1970: 1_700_001_000)
    let tx = InboxTransaction(
        id: "t1",
        date: now,
        merchantName: "A",
        descriptionRaw: "A",
        amount: -10,
        category: "Groceries",
        inboxState: "needs_review",
        suggestedCategoryId: nil,
        confidence: nil,
        importedAt: now
    )

    let provider = StubInboxProvider(
        inbox: InboxResponse(
            ok: true,
            transactions: [tx],
            pagination: InboxPagination(page: 1, perPage: 50, total: 1, totalPages: 1)
        ),
        stats: InboxStatsResponse(ok: true, toClearCount: 1, streak: 0, autoClassifiedPercent: 0)
    )
    let markerStore = InMemoryInboxMarkerStore()
    let service = InboxSyncService(provider: provider, markerStore: markerStore, now: { now })
    let scheduler = RecordingScheduler()
    let coordinator = InboxRefreshCoordinator(syncService: service, scheduler: scheduler)

    _ = try await coordinator.refresh()

    let receivedCount = await scheduler.readLastCount()
    #expect(receivedCount == 1)
}
