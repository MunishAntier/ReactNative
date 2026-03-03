import SwiftUI

struct ContentView: View {
    @StateObject var viewModel: AppViewModel

    var body: some View {
        VStack(spacing: 10) {
            Text("Secure Messaging")
                .font(.title2)
                .bold()

            Text(viewModel.status)
                .font(.caption)

            GroupBox("Authentication") {
                TextField("email or phone", text: $viewModel.identifier)
                    .textFieldStyle(.roundedBorder)
                    .keyboardType(.emailAddress)

                TextField("otp", text: $viewModel.otp)
                    .textFieldStyle(.roundedBorder)
                    .keyboardType(.numberPad)

                HStack {
                    Button("Request OTP") {
                        Task { await viewModel.requestOTP() }
                    }
                    .buttonStyle(.borderedProminent)

                    Button("Verify + Login") {
                        Task { await viewModel.verifyOTPAndLogin() }
                    }
                    .buttonStyle(.bordered)
                }
            }

            GroupBox("Chat") {
                TextField("receiver user id", text: $viewModel.receiverUserIDText)
                    .textFieldStyle(.roundedBorder)
                    .keyboardType(.numberPad)

                TextField("message", text: $viewModel.messageText)
                    .textFieldStyle(.roundedBorder)

                HStack {
                    Button("Send") {
                        Task { await viewModel.sendMessage() }
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(!viewModel.isAuthenticated)

                    Button("Sync") {
                        Task { await viewModel.syncNow() }
                    }
                    .buttonStyle(.bordered)
                    .disabled(!viewModel.isAuthenticated)

                    Button("Logout") {
                        Task { await viewModel.logout() }
                    }
                    .buttonStyle(.bordered)
                    .disabled(!viewModel.isAuthenticated)
                }
            }

            GroupBox("Logs") {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 4) {
                        ForEach(Array(viewModel.logs.enumerated()), id: \.offset) { _, line in
                            Text(line)
                                .font(.system(.caption, design: .monospaced))
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                }
                .frame(maxHeight: 260)
            }
        }
        .padding(12)
    }
}
