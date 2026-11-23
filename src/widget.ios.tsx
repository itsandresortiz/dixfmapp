import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { clipShape, containerBackground, font, foregroundStyle, frame, lineLimit, resizable, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { Asset } from 'expo-asset';
import { Directory, File } from 'expo-file-system';
import { createWidget, widgetsDirectory, type WidgetEnvironment } from 'expo-widgets';

export type WidgetState = { title: string; artist: string; live: boolean; artUrl?: string };
type Props = { title: string; artist: string; live: boolean; art?: string; logo?: string };

// Se ejecuta aislado dentro del widget: todo lo que usa debe declararse dentro de la función.
const DixWidget = (props: Props, environment: WidgetEnvironment) => {
  'widget';
  const family = environment.widgetFamily;
  const muted = '#c4bfe0';
  const open = widgetURL('dixfm://play'); // tocar el widget abre la app y empieza a sonar

  // Pantalla de bloqueo: solo texto, lo tiñe el sistema.
  if (family === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={1} modifiers={[containerBackground('#00000000', 'widget'), open]}>
        <HStack spacing={4}>
          <Image systemName="dot.radiowaves.left.and.right" size={12} />
          <Text modifiers={[font({ size: 12, weight: 'semibold' })]}>{props.live ? 'Dix FM en vivo' : 'Dix FM'}</Text>
          <Spacer />
        </HStack>
        <Text modifiers={[font({ size: 15, weight: 'bold' }), lineLimit(1)]}>{props.title}</Text>
        <Text modifiers={[font({ size: 13 }), lineLimit(1)]}>{props.artist}</Text>
      </VStack>
    );
  }

  const background = containerBackground(
    { type: 'linearGradient', colors: ['#4a2fb5', '#241656', '#0d0820'], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } },
    'widget'
  );

  const live = (
    <HStack spacing={5}>
      <Image systemName="dot.radiowaves.left.and.right" size={12} color={props.live ? '#ff375f' : muted} />
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(props.live ? '#ffffff' : muted)]}>
        {props.live ? 'En vivo' : 'Radio'}
      </Text>
    </HStack>
  );

  const brand = props.logo ? (
    <Image uiImage={props.logo} modifiers={[resizable(), frame({ width: 46, height: 18 })]} />
  ) : (
    <Text modifiers={[font({ size: 15, weight: 'heavy' }), foregroundStyle('#ffffff')]}>Dix FM</Text>
  );

  const art = (side: number, radius: number) =>
    props.art ? (
      <Image uiImage={props.art} modifiers={[resizable(), frame({ width: side, height: side }), clipShape('roundedRectangle', radius)]} />
    ) : (
      <Image systemName="play.circle.fill" size={side * 0.8} color="#ffffff" modifiers={[frame({ width: side, height: side })]} />
    );

  if (family === 'systemSmall') {
    return (
      <VStack alignment="leading" spacing={2} modifiers={[background, open]}>
        <HStack>
          {art(50, 11)}
          <Spacer />
          <VStack alignment="trailing" spacing={6}>
            {brand}
            {live}
          </VStack>
        </HStack>
        <Spacer />
        <Text modifiers={[font({ size: 16, weight: 'bold' }), foregroundStyle('#ffffff'), lineLimit(2)]}>{props.title}</Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(muted), lineLimit(1)]}>{props.artist}</Text>
      </VStack>
    );
  }

  const big = family === 'systemLarge';
  const text = (
    <VStack alignment="leading" spacing={3}>
      <HStack>
        {brand}
        <Spacer />
        {live}
      </HStack>
      <Spacer />
      <Text modifiers={[font({ size: big ? 24 : 19, weight: 'bold' }), foregroundStyle('#ffffff'), lineLimit(2)]}>{props.title}</Text>
      <Text modifiers={[font({ size: big ? 16 : 14 }), foregroundStyle(muted), lineLimit(1)]}>{props.artist}</Text>
      <Spacer />
      <HStack spacing={6}>
        <Image systemName="play.fill" size={12} color="#ffffff" />
        <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle('#ffffff')]}>
          {props.live ? 'Sonando ahora' : 'Escuchar en vivo'}
        </Text>
      </HStack>
    </VStack>
  );

  if (big) {
    return (
      <VStack alignment="leading" spacing={14} modifiers={[background, open]}>
        <HStack>
          <Spacer />
          {art(190, 22)}
          <Spacer />
        </HStack>
        {text}
      </VStack>
    );
  }

  return (
    <HStack spacing={14} modifiers={[background, open]}>
      {art(118, 18)}
      {text}
    </HStack>
  );
};

const widget = createWidget<Props>('DixFM', DixWidget, {
  title: 'Dix FM',
  artist: 'Toca para escuchar en vivo',
  live: false,
});

// Las imágenes del widget deben vivir en la carpeta compartida con la extensión.
let logoPath: string | undefined;
let art: { url: string; path: string } | undefined;
let latest = 0;

async function ensureLogo() {
  if (logoPath || !widgetsDirectory) return;
  const destination = new File(widgetsDirectory, 'logo.png');
  if (!destination.exists) {
    const asset = Asset.fromModule(require('../assets/logo-white.png'));
    await asset.downloadAsync();
    if (!asset.localUri) return;
    new File(asset.localUri).copy(destination);
  }
  logoPath = destination.uri;
}

async function ensureArt(url?: string) {
  if (!widgetsDirectory || url === art?.url) return;
  const previous = art;
  art = undefined;
  if (url) {
    const directory = new Directory(widgetsDirectory);
    // Nombre nuevo por canción: con la misma ruta el widget seguiría mostrando la imagen anterior.
    const file = await File.downloadFileAsync(url, new File(directory, `art-${Date.now()}.jpg`));
    art = { url, path: file.uri };
  }
  if (previous) {
    try {
      new File(previous.path).delete();
    } catch {
      // ya no existe
    }
  }
}

export function updateWidget(state: WidgetState) {
  const ticket = ++latest;
  // 300 px bastan para el widget y respetan su límite de memoria.
  const artUrl = state.artUrl?.replace('600x600', '300x300');
  const push = () => {
    if (ticket !== latest) return;
    try {
      widget.updateSnapshot({
        title: state.title,
        artist: state.artist,
        live: state.live,
        art: art && art.url === artUrl ? art.path : undefined,
        logo: logoPath,
      });
    } catch {
      // Sin extensión de widget (por ejemplo, en desarrollo).
    }
  };
  push();
  Promise.all([ensureLogo().catch(() => {}), ensureArt(artUrl).catch(() => {})]).then(push);
}
