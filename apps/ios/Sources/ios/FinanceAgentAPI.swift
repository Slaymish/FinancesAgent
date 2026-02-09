import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

public struct FinanceAgentAPIConfiguration: Sendable {
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
}

public enum FinanceAgentAPIError: Error, Equatable {
    case invalidPath(String)
    case invalidResponse
    case requestFailed
    case serverError(statusCode: Int, message: String?)
    case decodeFailed
}

public struct FinanceAgentAPI: @unchecked Sendable {
    public let configuration: FinanceAgentAPIConfiguration
    private let session: URLSession

    public init(configuration: FinanceAgentAPIConfiguration, session: URLSession = .shared) {
        self.configuration = configuration
        self.session = session
    }

    public func fetchInbox(page: Int = 1, perPage: Int = 50) async throws -> InboxResponse {
        var components = URLComponents(url: configuration.baseURL, resolvingAgainstBaseURL: false)
        components?.path = "/api/inbox"
        components?.queryItems = [
            URLQueryItem(name: "page", value: String(max(page, 1))),
            URLQueryItem(name: "perPage", value: String(max(1, min(perPage, 100))))
        ]

        guard let url = components?.url else {
            throw FinanceAgentAPIError.invalidPath("/api/inbox")
        }

        var request = URLRequest(url: url)
        applyHeaders(to: &request)
        return try await execute(request, decodeAs: InboxResponse.self)
    }

    public func fetchInboxStats() async throws -> InboxStatsResponse {
        let request = try makeRequest(path: "/api/inbox/stats", method: "GET")
        return try await execute(request, decodeAs: InboxStatsResponse.self)
    }

    public func fetchTransactionCategories() async throws -> TransactionCategoriesResponse {
        let request = try makeRequest(path: "/api/transactions/categories?limit=1", method: "GET")
        return try await execute(request, decodeAs: TransactionCategoriesResponse.self)
    }

    public func confirmInboxTransaction(
        id: String,
        categoryId: String,
        categoryType: String? = nil
    ) async throws -> InboxConfirmResponse {
        let body = InboxConfirmBody(categoryId: categoryId, categoryType: categoryType)
        let request = try makeRequest(path: "/api/inbox/\(id)/confirm", method: "POST", body: body)
        return try await execute(request, decodeAs: InboxConfirmResponse.self)
    }

    private func makeRequest(path: String, method: String) throws -> URLRequest {
        let sanitizedPath = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let url = configuration.baseURL.appending(path: sanitizedPath)
        var request = URLRequest(url: url)
        request.httpMethod = method
        applyHeaders(to: &request)
        return request
    }

    private func makeRequest<T: Encodable>(path: String, method: String, body: T) throws -> URLRequest {
        var request = try makeRequest(path: path, method: method)
        request.setValue("application/json", forHTTPHeaderField: "content-type")
        request.httpBody = try FinanceAgentCoders.encoder.encode(body)

        return request
    }

    private func applyHeaders(to request: inout URLRequest) {
        request.setValue(configuration.userId, forHTTPHeaderField: "x-user-id")
        request.setValue(configuration.internalApiKey, forHTTPHeaderField: "x-internal-api-key")
        if let pipelineToken = configuration.pipelineToken, !pipelineToken.isEmpty {
            request.setValue(pipelineToken, forHTTPHeaderField: "x-pipeline-token")
        }
    }

    private func execute<Response: Decodable>(
        _ request: URLRequest,
        decodeAs type: Response.Type
    ) async throws -> Response {
        let data: Data
        let response: URLResponse

        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw FinanceAgentAPIError.requestFailed
        }

        guard let httpResponse = response as? HTTPURLResponse else {
            throw FinanceAgentAPIError.invalidResponse
        }

        guard 200 ... 299 ~= httpResponse.statusCode else {
            let errorBody = try? FinanceAgentCoders.decoder.decode(APIErrorBody.self, from: data)
            throw FinanceAgentAPIError.serverError(statusCode: httpResponse.statusCode, message: errorBody?.error)
        }

        do {
            return try FinanceAgentCoders.decoder.decode(type, from: data)
        } catch {
            throw FinanceAgentAPIError.decodeFailed
        }
    }
}

private struct APIErrorBody: Decodable {
    let error: String?
}

private struct InboxConfirmBody: Encodable {
    let categoryId: String
    let categoryType: String?
}
