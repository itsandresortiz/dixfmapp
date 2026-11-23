import AVKit
import ExpoModulesCore

// Botón del sistema para elegir salida de audio (AirPlay, altavoces, auriculares).
class AirPlayButtonView: ExpoView {
  let picker = AVRoutePickerView()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    backgroundColor = .clear
    picker.backgroundColor = .clear
    picker.tintColor = .white
    picker.activeTintColor = UIColor(red: 1.0, green: 0.216, blue: 0.373, alpha: 1.0)
    picker.prioritizesVideoDevices = false
    picker.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    picker.frame = bounds
    addSubview(picker)
  }
}
