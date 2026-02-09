#if canImport(BackgroundTasks)
import BackgroundTasks
import Foundation

@available(iOS 16.0, *)
public actor InboxBackgroundRefreshManager {
    private let taskIdentifier: String
    private let coordinator: InboxRefreshCoordinator
    private let minimumInterval: TimeInterval

    public init(
        taskIdentifier: String,
        coordinator: InboxRefreshCoordinator,
        minimumInterval: TimeInterval = 60 * 60
    ) {
        self.taskIdentifier = taskIdentifier
        self.coordinator = coordinator
        self.minimumInterval = minimumInterval
    }

    public func register() {
        BGTaskScheduler.shared.register(forTaskWithIdentifier: taskIdentifier, using: nil) { task in
            guard let refreshTask = task as? BGAppRefreshTask else {
                task.setTaskCompleted(success: false)
                return
            }

            Task {
                await self.handle(refreshTask: refreshTask)
            }
        }
    }

    public func scheduleNext(from date: Date = Date()) {
        let request = BGAppRefreshTaskRequest(identifier: taskIdentifier)
        request.earliestBeginDate = date.addingTimeInterval(minimumInterval)

        do {
            try BGTaskScheduler.shared.submit(request)
        } catch {
            // No-op: scheduling can fail in simulator or when system policy denies requests.
        }
    }

    private func handle(refreshTask: BGAppRefreshTask) async {
        refreshTask.expirationHandler = {
            refreshTask.setTaskCompleted(success: false)
        }

        do {
            _ = try await coordinator.refresh(page: 1, perPage: 50)
            refreshTask.setTaskCompleted(success: true)
        } catch {
            refreshTask.setTaskCompleted(success: false)
        }

        scheduleNext()
    }
}
#endif
