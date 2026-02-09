#if canImport(SwiftUI)
import SwiftUI

@available(iOS 16.0, *)
public struct InboxDashboardView: View {
    public let snapshot: InboxSyncSnapshot
    public let onConfirm: (InboxTransaction, String) async -> Void

    public init(
        snapshot: InboxSyncSnapshot,
        onConfirm: @escaping (InboxTransaction, String) async -> Void
    ) {
        self.snapshot = snapshot
        self.onConfirm = onConfirm
    }

    public var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(
                    colors: [Color.cyan.opacity(0.30), Color.blue.opacity(0.12), Color.white],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 14) {
                        statsRow
                        transactionList
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Inbox")
        }
    }

    private var statsRow: some View {
        HStack(spacing: 10) {
            statCard(title: "To Clear", value: "\(snapshot.stats.toClearCount)")
            statCard(title: "Streak", value: "\(snapshot.stats.streak)")
            statCard(title: "New", value: "\(snapshot.newToClassifyCount)")
        }
    }

    private var transactionList: some View {
        VStack(spacing: 10) {
            ForEach(snapshot.transactions, id: \.id) { transaction in
                transactionRow(transaction)
            }
        }
    }

    private func transactionRow(_ transaction: InboxTransaction) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(transaction.merchantName)
                    .font(.headline)
                    .lineLimit(1)
                Spacer()
                Text(transaction.amount, format: .currency(code: "NZD"))
                    .font(.headline)
            }

            Text(transaction.descriptionRaw)
                .font(.subheadline)
                .foregroundStyle(.secondary)

            Text(transaction.date, style: .date)
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(Color.white.opacity(0.4), lineWidth: 0.6)
        )
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button("Confirm") {
                Task {
                    await onConfirm(transaction, transaction.suggestedCategoryId ?? transaction.category)
                }
            }
            .tint(.green)
        }
    }

    private func statCard(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.title3.weight(.semibold))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .strokeBorder(Color.white.opacity(0.35), lineWidth: 0.6)
        )
    }
}
#endif
