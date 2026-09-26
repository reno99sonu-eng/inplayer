import Flutter
import UIKit

public class IvsBroadcastPlugin: NSObject, FlutterPlugin {
    public static func register(with registrar: FlutterPluginRegistrar) {
        let channel = FlutterMethodChannel(
            name: "inplayer/ivs_broadcast",
            binaryMessenger: registrar.messenger()
        )

        let instance = IvsBroadcastPlugin()
        registrar.addMethodCallDelegate(instance, channel: channel)
    }

    public func handle(
        _ call: FlutterMethodCall,
        result: @escaping FlutterResult
    ) {
        switch call.method {
        case "isSupported":
            result(false)

        case "start":
            result(
                FlutterError(
                    code: "unsupported",
                    message: "Native IVS broadcasting is not available on iOS yet.",
                    details: nil
                )
            )

        case "stop":
            result(true)

        case "setMicMuted",
             "setCameraEnabled",
             "switchCamera":
            result(false)

        case "isFrontCamera":
            result(true)

        case "refreshPreview":
            result(true)

        default:
            result(FlutterMethodNotImplemented)
        }
    }
}
