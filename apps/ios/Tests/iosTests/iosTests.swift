import Foundation
import Testing
@testable import ios

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
