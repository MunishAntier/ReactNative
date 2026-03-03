import SwiftUI

@main
struct SecureMsgDemoApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView(
                viewModel: AppViewModel(
                    baseURL: URL(string: ProcessInfo.processInfo.environment["BACKEND_BASE_URL"] ?? "http://127.0.0.1:8080/")!
                )
            )
        }
    }
}
