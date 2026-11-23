import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, lineLimit, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type DixWidgetProps = { title: string; artist: string; live: boolean };

// Se ejecuta aislado dentro del widget: todo lo que usa debe declararse dentro de la función.
const DixWidget = (props: DixWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const small = environment.widgetFamily === 'systemSmall';
  const muted = '#b9b4d0';

  const text = (
    <VStack alignment="leading" spacing={3}>
      <HStack spacing={6}>
        <Image systemName="dot.radiowaves.left.and.right" size={13} color={props.live ? '#ff375f' : muted} />
        <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(props.live ? '#ffffff' : muted)]}>
          {props.live ? 'En vivo' : 'Dix FM'}
        </Text>
        <Spacer />
      </HStack>
      <Spacer />
      <Text modifiers={[font({ size: small ? 17 : 20, weight: 'bold' }), foregroundStyle('#ffffff'), lineLimit(2)]}>{props.title}</Text>
      <Text modifiers={[font({ size: 13 }), foregroundStyle(muted), lineLimit(1)]}>{props.artist}</Text>
    </VStack>
  );

  // Tocar el widget abre la app y empieza a sonar.
  const root = [containerBackground('#0d0820', 'widget'), widgetURL('dixfm://play')];

  if (small) return <VStack modifiers={root}>{text}</VStack>;
  return (
    <HStack spacing={12} modifiers={root}>
      {text}
      <Image systemName="play.circle.fill" size={46} color="#ffffff" />
    </HStack>
  );
};

export default createWidget<DixWidgetProps>('DixFM', DixWidget, {
  title: 'Dix FM',
  artist: 'Toca para escuchar en vivo',
  live: false,
});
