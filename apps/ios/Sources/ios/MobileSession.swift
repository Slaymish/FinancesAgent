import Foundation

public struct MobileSession: Codable, Sendable, Equatable {
    public let baseURL: URL
    public let userId: String
    public let internalApiKey: String
    public let pipelineToken: String?

    public init(baseURL: URL, userId: String, internalApiKey: String, pipelineToken: String? = nil) {
        self.baseURL = baseURL
        self.userId = userId
        self.internalApiKey = internalApiKey
        self.pipelineToken = pipelineToken
    }

    public func asAPIConfiguration() -> FinanceAgentAPIConfiguration {
        FinanceAgentAPIConfiguration(
            baseURL: baseURL,
            userId: userId,
            internalApiKey: internalApiKey,
            pipelineToken: pipelineToken
        )
    }
}

public protocol MobileSessionStoring: Sendable {
    func load() async -> MobileSession?
    func save(_ session: MobileSession?) async
}

public actor InMemoryMobileSessionStore: MobileSessionStoring {
    private var session: MobileSession?

    public init(initialSession: MobileSession? = nil) {
        session = initialSession
    }

    public func load() async -> MobileSession? {
        session
    }

    public func save(_ session: MobileSession?) async {
        self.session = session
    }
}

public actor UserDefaultsMobileSessionStore: MobileSessionStoring {
    private let defaults: UserDefaults
    private let key: String

    public init(defaults: UserDefaults = .standard, key: String = "finance_agent.mobile_session") {
        self.defaults = defaults
        self.key = key
    }

    public func load() async -> MobileSession? {
        guard let data = defaults.data(forKey: key) else {
            return nil
        }
        return try? FinanceAgentCoders.decoder.decode(MobileSession.self, from: data)
    }

    public func save(_ session: MobileSession?) async {
        guard let session else {
            defaults.removeObject(forKey: key)
            return
        }

        guard let encoded = try? FinanceAgentCoders.encoder.encode(session) else {
            return
        }
        defaults.set(encoded, forKey: key)
    }
}
