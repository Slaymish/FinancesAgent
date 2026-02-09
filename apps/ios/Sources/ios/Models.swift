import Foundation

public enum FinanceAgentCoders {
    public static let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .custom { value in
            let container = try value.singleValueContainer()
            let rawValue = try container.decode(String.self)

            let withFractionalSeconds = ISO8601DateFormatter()
            withFractionalSeconds.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = withFractionalSeconds.date(from: rawValue) {
                return date
            }

            let standard = ISO8601DateFormatter()
            standard.formatOptions = [.withInternetDateTime]
            if let date = standard.date(from: rawValue) {
                return date
            }

            throw DecodingError.dataCorruptedError(
                in: container,
                debugDescription: "Expected ISO8601 date string."
            )
        }
        return decoder
    }()

    public static let encoder: JSONEncoder = {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        return encoder
    }()
}

public struct InboxResponse: Codable, Sendable {
    public let ok: Bool
    public let transactions: [InboxTransaction]
    public let pagination: InboxPagination
}

public struct InboxPagination: Codable, Sendable {
    public let page: Int
    public let perPage: Int
    public let total: Int
    public let totalPages: Int
}

public struct InboxTransaction: Codable, Sendable {
    public let id: String
    public let date: Date
    public let merchantName: String
    public let descriptionRaw: String
    public let amount: Double
    public let category: String
    public let inboxState: String
    public let suggestedCategoryId: String?
    public let confidence: Double?
    public let importedAt: Date?
}

public struct InboxStatsResponse: Codable, Sendable {
    public let ok: Bool
    public let toClearCount: Int
    public let streak: Int
    public let autoClassifiedPercent: Int
}

public struct TransactionCategoriesResponse: Codable, Sendable {
    public let ok: Bool
    public let categories: [TransactionCategorySummary]
}

public struct TransactionCategorySummary: Codable, Sendable {
    public let category: String
    public let count: Int
    public let expenseTotal: Double
    public let incomeTotal: Double
    public let lastDate: Date?
}

public struct InboxConfirmResponse: Codable, Sendable {
    public let ok: Bool
    public let transaction: InboxTransaction?
    public let modelRetrained: Bool?
    public let reclassified: Int?
    public let warning: String?
}

public enum InboxNotificationCounter {
    public static func newTransactionsToClassify(
        from transactions: [InboxTransaction],
        since lastSeenImportedAt: Date?
    ) -> Int {
        guard let marker = lastSeenImportedAt else {
            return transactions.count
        }

        return transactions.reduce(into: 0) { count, transaction in
            let eventDate = transaction.importedAt ?? transaction.date
            if eventDate > marker {
                count += 1
            }
        }
    }

    public static func updatedMarker(
        from transactions: [InboxTransaction],
        existingMarker: Date?
    ) -> Date? {
        let latest = transactions
            .map { $0.importedAt ?? $0.date }
            .max()

        guard let latest else {
            return existingMarker
        }
        guard let existingMarker else {
            return latest
        }

        return max(latest, existingMarker)
    }
}
