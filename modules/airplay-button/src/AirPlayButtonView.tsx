import { requireNativeView } from 'expo';
import type { ComponentType } from 'react';
import { Platform, type ViewProps } from 'react-native';

const NativeView: ComponentType<ViewProps> | null = Platform.OS === 'ios' ? requireNativeView('AirPlayButton') : null;

/** Botón de AirPlay del sistema. Solo existe en iOS; en el resto no dibuja nada. */
export default function AirPlayButtonView(props: ViewProps) {
  return NativeView ? <NativeView {...props} /> : null;
}
