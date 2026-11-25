import Flutter
import UIKit

class SceneDelegate: FlutterSceneDelegate {
  // Safety selector shim: prevents unrecognized selector crashes from legacy
  // or GoogleUtilities/Cocoa callers sending [synchronize] to the scene delegate
  @objc func synchronize() -> Bool {
    return true
  }
}
