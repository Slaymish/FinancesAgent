#if canImport(SwiftUI)
import SwiftUI

@available(iOS 16.0, *)
@MainActor
public final class InboxAppViewModel: ObservableObject {
    @Published public private(set) var transactions: [InboxTransaction] = []
    @Published public private(set) var stats: InboxStatsResponse?
    @Published public private(set) var newToClassifyCount: Int = 0
    @Published public private(set) var knownCategories: [String] = []
    @Published public private(set) var isLoading: Bool = false
    @Published public private(set) var confirmingIds: Set<String> = []
    @Published public private(set) var errorMessage: String?
    @Published public var categoryDraftById: [String: String] = [:]

    private let api: FinanceAgentAPI
    private let coordinator: InboxRefreshCoordinator
    private var hasLoaded = false

    public init(api: FinanceAgentAPI, coordinator: InboxRefreshCoordinator) {
        self.api = api
        self.coordinator = coordinator
    }

    public func loadIfNeeded() async {
        guard !hasLoaded else { return }
        hasLoaded = true
        await refresh()
    }

    public func refresh() async {
        isLoading = true
        defer { isLoading = false }

        do {
            async let snapshotTask = coordinator.refresh(page: 1, perPage: 50)
            async let categoriesTask: [String] = {
                do {
                    let response = try await api.fetchTransactionCategories()
                    return response.categories
                        .map(\.category)
                        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                        .filter { !$0.isEmpty }
                } catch {
                    return []
                }
            }()

            let snapshot = try await snapshotTask
            let categories = await categoriesTask

            applySnapshot(snapshot, knownCategories: categories)
            errorMessage = nil
        } catch {
            errorMessage = "Failed to refresh inbox."
        }
    }

    public func categoryDraft(for transaction: InboxTransaction) -> String {
        categoryDraftById[transaction.id] ?? preferredCategory(for: transaction)
    }

    public func setCategoryDraft(_ value: String, transactionId: String) {
        categoryDraftById[transactionId] = value
    }

    public func clearError() {
        errorMessage = nil
    }

    public func confirm(transactionId: String) async {
        guard let index = transactions.firstIndex(where: { $0.id == transactionId }) else {
            return
        }

        let oldTransactions = transactions
        let oldDrafts = categoryDraftById
        let oldStats = stats
        let oldNewCount = newToClassifyCount

        let transaction = transactions[index]
        let category = normalizedDraft(transactionId: transaction.id, fallback: preferredCategory(for: transaction))

        confirmingIds.insert(transaction.id)
        transactions.remove(at: index)
        categoryDraftById.removeValue(forKey: transaction.id)

        if let stats {
            self.stats = InboxStatsResponse(
                ok: stats.ok,
                toClearCount: max(0, stats.toClearCount - 1),
                streak: stats.streak,
                autoClassifiedPercent: stats.autoClassifiedPercent
            )
        }
        if newToClassifyCount > 0 {
            newToClassifyCount -= 1
        }
        knownCategories = uniqueSorted([category] + knownCategories)

        do {
            _ = try await api.confirmInboxTransaction(id: transaction.id, categoryId: category, categoryType: nil)
            confirmingIds.remove(transaction.id)
            errorMessage = nil
        } catch {
            transactions = oldTransactions
            categoryDraftById = oldDrafts
            stats = oldStats
            newToClassifyCount = oldNewCount
            confirmingIds.remove(transaction.id)
            errorMessage = "Failed to confirm category for \(transaction.merchantName)."
        }
    }

    private func applySnapshot(_ snapshot: InboxSyncSnapshot, knownCategories categoriesFromAPI: [String]) {
        transactions = snapshot.transactions
        stats = snapshot.stats
        newToClassifyCount = snapshot.newToClassifyCount

        let existingDrafts = categoryDraftById
        categoryDraftById = Dictionary(
            uniqueKeysWithValues: snapshot.transactions.map { transaction in
                let value = existingDrafts[transaction.id] ?? preferredCategory(for: transaction)
                return (transaction.id, value)
            }
        )

        let snapshotCategories = snapshot.transactions
            .flatMap { transaction in
                [transaction.category, transaction.suggestedCategoryId ?? ""]
            }

        knownCategories = uniqueSorted(
            categoriesFromAPI + snapshotCategories + ["Uncategorised"]
        )
    }

    private func normalizedDraft(transactionId: String, fallback: String) -> String {
        let value = categoryDraftById[transactionId]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !value.isEmpty {
            return value
        }

        let fallbackTrimmed = fallback.trimmingCharacters(in: .whitespacesAndNewlines)
        return fallbackTrimmed.isEmpty ? "Uncategorised" : fallbackTrimmed
    }

    private func preferredCategory(for transaction: InboxTransaction) -> String {
        let suggested = transaction.suggestedCategoryId?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !suggested.isEmpty {
            return suggested
        }

        let category = transaction.category.trimmingCharacters(in: .whitespacesAndNewlines)
        return category.isEmpty ? "Uncategorised" : category
    }

    private func uniqueSorted(_ values: [String]) -> [String] {
        Array(Set(values.filter { !$0.isEmpty })).sorted { $0.localizedCaseInsensitiveCompare($1) == .orderedAscending }
    }
}
#endif
