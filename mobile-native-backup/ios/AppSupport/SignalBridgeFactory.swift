import Foundation

struct SignalBridgeSelection {
    let bridge: SignalProtocolBridge
    let implementation: String
}

enum SignalBridgeFactory {
    static func make() -> SignalBridgeSelection {
        SignalBridgeSelection(
            bridge: PlainSignalProtocolBridge(),
            implementation: "plain-fallback"
        )
    }
}
