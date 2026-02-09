#if canImport(SwiftUI)
import SwiftUI

@available(iOS 16.0, *)
@MainActor
public final class MobileSessionViewModel: ObservableObject {
    @Published public private(set) var session: MobileSession?
    @Published public var baseURLText: String = ""
    @Published public var userIdText: String = ""
    @Published public var internalApiKeyText: String = ""
    @Published public var pipelineTokenText: String = ""
    @Published public private(set) var errorMessage: String?

    private let store: any MobileSessionStoring
    private var loaded = false

    public init(store: any MobileSessionStoring = UserDefaultsMobileSessionStore()) {
        self.store = store
    }

    public func loadIfNeeded() async {
        guard !loaded else { return }
        loaded = true

        let loadedSession = await store.load()
        session = loadedSession
        apply(session: loadedSession)
    }

    @discardableResult
    public func save() async -> Bool {
        let baseURLRaw = baseURLText.trimmingCharacters(in: .whitespacesAndNewlines)
        let userId = userIdText.trimmingCharacters(in: .whitespacesAndNewlines)
        let internalApiKey = internalApiKeyText.trimmingCharacters(in: .whitespacesAndNewlines)
        let pipelineToken = pipelineTokenText.trimmingCharacters(in: .whitespacesAndNewlines)

        guard let baseURL = URL(string: baseURLRaw), baseURL.scheme != nil else {
            errorMessage = "Enter a valid API base URL, for example https://api.example.com"
            return false
        }

        guard !userId.isEmpty else {
            errorMessage = "User ID is required."
            return false
        }

        guard !internalApiKey.isEmpty else {
            errorMessage = "Internal API key is required."
            return false
        }

        let newSession = MobileSession(
            baseURL: baseURL,
            userId: userId,
            internalApiKey: internalApiKey,
            pipelineToken: pipelineToken.isEmpty ? nil : pipelineToken
        )

        await store.save(newSession)
        session = newSession
        errorMessage = nil
        return true
    }

    public func clearSession() async {
        await store.save(nil)
        session = nil
        baseURLText = ""
        userIdText = ""
        internalApiKeyText = ""
        pipelineTokenText = ""
        errorMessage = nil
    }

    public func clearError() {
        errorMessage = nil
    }

    private func apply(session: MobileSession?) {
        guard let session else { return }
        baseURLText = session.baseURL.absoluteString
        userIdText = session.userId
        internalApiKeyText = session.internalApiKey
        pipelineTokenText = session.pipelineToken ?? ""
    }
}

@available(iOS 16.0, *)
public struct FinanceAgentRootView: View {
    @StateObject private var sessionModel: MobileSessionViewModel
    @State private var isShowingSessionEditor: Bool = false

    public init(sessionStore: any MobileSessionStoring = UserDefaultsMobileSessionStore()) {
        _sessionModel = StateObject(wrappedValue: MobileSessionViewModel(store: sessionStore))
    }

    public var body: some View {
        Group {
            if let session = sessionModel.session {
                ZStack(alignment: .bottomTrailing) {
                    InboxDashboardView(model: makeInboxViewModel(session: session))
                        .id("\(session.baseURL.absoluteString)|\(session.userId)")

                    Button {
                        isShowingSessionEditor = true
                    } label: {
                        Image(systemName: "slider.horizontal.3")
                            .font(.headline)
                            .padding(14)
                            .background(.thinMaterial, in: Circle())
                    }
                    .padding()
                }
                .sheet(isPresented: $isShowingSessionEditor) {
                    sessionEditor
                }
            } else {
                sessionEditor
            }
        }
        .task {
            await sessionModel.loadIfNeeded()
        }
    }

    private var sessionEditor: some View {
        NavigationStack {
            Form {
                Section("Connection") {
                    TextField("API Base URL", text: $sessionModel.baseURLText)
                        .keyboardType(.URL)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)
                    TextField("User ID", text: $sessionModel.userIdText)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)
                    SecureField("Internal API Key", text: $sessionModel.internalApiKeyText)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)
                    SecureField("Pipeline Token (optional)", text: $sessionModel.pipelineTokenText)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled(true)
                }

                Section {
                    Button("Save Session") {
                        Task {
                            if await sessionModel.save() {
                                isShowingSessionEditor = false
                            }
                        }
                    }

                    if sessionModel.session != nil {
                        Button("Clear Session", role: .destructive) {
                            Task {
                                await sessionModel.clearSession()
                                isShowingSessionEditor = false
                            }
                        }
                    }
                }
            }
            .navigationTitle("FinanceAgent Setup")
            .toolbar {
                if sessionModel.session != nil {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Done") {
                            isShowingSessionEditor = false
                        }
                    }
                }
            }
            .alert(
                "Session Error",
                isPresented: Binding(
                    get: { sessionModel.errorMessage != nil },
                    set: { presented in
                        if !presented {
                            sessionModel.clearError()
                        }
                    }
                )
            ) {
                Button("OK", role: .cancel) {
                    sessionModel.clearError()
                }
            } message: {
                Text(sessionModel.errorMessage ?? "")
            }
        }
    }

    private func makeInboxViewModel(session: MobileSession) -> InboxAppViewModel {
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

        return InboxAppViewModel(api: api, coordinator: coordinator)
    }
}
#endif
