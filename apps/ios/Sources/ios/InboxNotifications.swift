import Foundation

public protocol InboxNotificationScheduling: Sendable {
    func scheduleDailySummary(newToClassifyCount: Int) async throws
}

public struct InboxNotificationPayload: Sendable {
    public let title: String
    public let body: String

    public init(title: String, body: String) {
        self.title = title
        self.body = body
    }

    public static func dailySummary(newToClassifyCount: Int) -> InboxNotificationPayload? {
        guard newToClassifyCount > 0 else {
            return nil
        }

        let noun = newToClassifyCount == 1 ? "transaction" : "transactions"
        return InboxNotificationPayload(
            title: "FinanceAgent Inbox",
            body: "There's \(newToClassifyCount) new \(noun) to classify."
        )
    }
}

#if canImport(UserNotifications)
import UserNotifications

public struct IOSInboxNotificationScheduler: InboxNotificationScheduling, @unchecked Sendable {
    private let center: UNUserNotificationCenter
    private let identifier: String

    public init(
        center: UNUserNotificationCenter = .current(),
        identifier: String = "finance_agent.daily_inbox_summary"
    ) {
        self.center = center
        self.identifier = identifier
    }

    public func scheduleDailySummary(newToClassifyCount: Int) async throws {
        guard let payload = InboxNotificationPayload.dailySummary(newToClassifyCount: newToClassifyCount) else {
            center.removePendingNotificationRequests(withIdentifiers: [identifier])
            return
        }

        let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
        guard granted else {
            return
        }

        let content = UNMutableNotificationContent()
        content.title = payload.title
        content.body = payload.body
        content.sound = .default

        var dateComponents = DateComponents()
        dateComponents.hour = 18
        dateComponents.minute = 0

        let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)
        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)

        center.removePendingNotificationRequests(withIdentifiers: [identifier])
        try await center.add(request)
    }
}
#endif
