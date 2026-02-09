#if canImport(SwiftUI)
import SwiftUI

@available(iOS 16.0, *)
public struct InboxDashboardView: View {
    @StateObject private var model: InboxAppViewModel

    public init(model: @autoclosure @escaping () -> InboxAppViewModel) {
        _model = StateObject(wrappedValue: model())
    }

    public var body: some View {
        NavigationStack {
            ZStack {
                LinearGradient(
                    colors: [Color.cyan.opacity(0.30), Color.blue.opacity(0.14), Color.white],
                    startPoint: .topLeading,
                    endPoint: .bottomTrailing
                )
                .ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 14) {
                        statsRow

                        if model.transactions.isEmpty && model.isLoading {
                            loadingCard
                        } else if model.transactions.isEmpty {
                            emptyState
                        } else {
                            transactionList
                        }
                    }
                    .padding(16)
                }
            }
            .navigationTitle("Inbox")
            .task {
                await model.loadIfNeeded()
            }
            .refreshable {
                await model.refresh()
            }
            .alert(
                "Inbox Error",
                isPresented: Binding(
                    get: { model.errorMessage != nil },
                    set: { isPresented in
                        if !isPresented {
                            model.clearError()
                        }
                    }
                )
            ) {
                Button("OK", role: .cancel) {
                    model.clearError()
                }
            } message: {
                Text(model.errorMessage ?? "")
            }
        }
    }

    private var statsRow: some View {
        HStack(spacing: 10) {
            statCard(title: "To Clear", value: "\(model.stats?.toClearCount ?? model.transactions.count)")
            statCard(title: "Streak", value: "\(model.stats?.streak ?? 0)")
            statCard(title: "New", value: "\(model.newToClassifyCount)")
        }
    }

    private var loadingCard: some View {
        VStack(spacing: 10) {
            ProgressView()
            Text("Loading inbox...")
                .font(.callout)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(20)
        .financeAgentGlassCard(cornerRadius: 16)
    }

    private var emptyState: some View {
        VStack(spacing: 8) {
            Text("Inbox clear")
                .font(.headline)
            Text("No transactions need review right now.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(20)
        .financeAgentGlassCard(cornerRadius: 16)
    }

    private var transactionList: some View {
        VStack(spacing: 10) {
            ForEach(model.transactions, id: \.id) { transaction in
                transactionRow(transaction)
            }
        }
    }

    private func transactionRow(_ transaction: InboxTransaction) -> some View {
        let confirmInFlight = model.confirmingIds.contains(transaction.id)
        let categoryBinding = Binding<String>(
            get: { model.categoryDraft(for: transaction) },
            set: { model.setCategoryDraft($0, transactionId: transaction.id) }
        )

        return VStack(alignment: .leading, spacing: 8) {
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

            TextField("Category", text: categoryBinding)
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled(true)
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(Color.white.opacity(0.65), in: RoundedRectangle(cornerRadius: 10, style: .continuous))

            if !model.knownCategories.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 6) {
                        ForEach(model.knownCategories.prefix(8), id: \.self) { category in
                            Button(category) {
                                model.setCategoryDraft(category, transactionId: transaction.id)
                            }
                            .font(.caption)
                            .buttonStyle(.bordered)
                            .tint(.blue)
                        }
                    }
                }
            }

            HStack {
                Spacer()
                Button(confirmInFlight ? "Confirming..." : "Confirm") {
                    Task {
                        await model.confirm(transactionId: transaction.id)
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(.green)
                .disabled(confirmInFlight)
            }
        }
        .padding(14)
        .financeAgentGlassCard(cornerRadius: 16, strokeOpacity: 0.4)
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button("Confirm") {
                Task {
                    await model.confirm(transactionId: transaction.id)
                }
            }
            .tint(.green)
            .disabled(confirmInFlight)
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
        .financeAgentGlassCard(cornerRadius: 14)
    }
}
#endif
