import ExpoModulesCore

public class AirPlayButtonModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AirPlayButton")

    View(AirPlayButtonView.self) {
    }
  }
}
