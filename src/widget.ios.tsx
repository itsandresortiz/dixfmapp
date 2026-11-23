import { Background, HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  blur,
  brightness,
  clipShape,
  containerBackground,
  font,
  foregroundStyle,
  frame,
  lineLimit,
  resizable,
  saturation,
  shadow,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { Asset } from 'expo-asset';
import { Directory, File } from 'expo-file-system';
import { createWidget, widgetsDirectory, type WidgetEnvironment } from 'expo-widgets';

export type WidgetState = { title: string; artist: string; live: boolean; artUrl?: string };
type Props = { title: string; artist: string; live: boolean; art?: string; logo?: string };

// Se ejecuta aislado dentro del widget: todo lo que usa debe declararse dentro de la función.
const DixWidget = (props: Props, environment: WidgetEnvironment) => {
  'widget';
  const family = environment.widgetFamily;
  const soft = '#e6e2f5';
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

  // Con carátula, el fondo es la propia carátula muy desenfocada; sin ella, los colores de la marca.
  const base = containerBackground(
    props.art
      ? '#0d0820'
      : { type: 'linearGradient', colors: ['#5b3fd6', '#2a1a66', '#0d0820'], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } },
    'widget'
  );
  const backdrop = props.art ? (
    <Image uiImage={props.art} modifiers={[resizable(), frame({ width: 460, height: 460 }), blur(42), saturation(1.35), brightness(-0.22)]} />
  ) : (
    <Spacer />
  );

  const cover = (side: number, radius: number) =>
    props.art ? (
      <Image
        uiImage={props.art}
        modifiers={[resizable(), frame({ width: side, height: side }), clipShape('roundedRectangle', radius), shadow({ radius: 10, y: 5, color: '#00000066' })]}
      />
    ) : (
      <Image systemName="play.circle.fill" size={side * 0.82} color="#ffffff" modifiers={[frame({ width: side, height: side })]} />
    );

  const brand = props.logo ? <Image uiImage={props.logo} modifiers={[resizable(), frame({ width: 48, height: 19 })]} /> : <Spacer />;

  const status = (
    <HStack spacing={5}>
      <Image systemName={props.live ? 'dot.radiowaves.left.and.right' : 'play.fill'} size={11} color={props.live ? '#ff5c7c' : '#ffffff'} />
      <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle('#ffffff')]}>{props.live ? 'En vivo' : 'Escuchar'}</Text>
    </HStack>
  );

  const titles = (titleSize: number, artistSize: number) => (
    <VStack alignment="leading" spacing={2}>
      <Text modifiers={[font({ size: titleSize, weight: 'bold' }), foregroundStyle('#ffffff'), lineLimit(2)]}>{props.title}</Text>
      <Text modifiers={[font({ size: artistSize }), foregroundStyle(soft), lineLimit(1)]}>{props.artist}</Text>
    </VStack>
  );

  let content;
  if (family === 'systemSmall') {
    content = (
      <VStack alignment="leading" spacing={6}>
        <HStack>
          {cover(58, 12)}
          <Spacer />
          <VStack alignment="trailing" spacing={0}>
            {brand}
            <Spacer />
          </VStack>
        </HStack>
        <Spacer />
        {status}
        {titles(15, 12)}
      </VStack>
    );
  } else if (family === 'systemLarge') {
    content = (
      <VStack alignment="leading" spacing={12}>
        <HStack>
          {status}
          <Spacer />
          {brand}
        </HStack>
        <HStack>
          <Spacer />
          {cover(196, 22)}
          <Spacer />
        </HStack>
        <Spacer />
        {titles(22, 16)}
      </VStack>
    );
  } else {
    content = (
      <HStack spacing={14}>
        {cover(122, 18)}
        <VStack alignment="leading" spacing={4}>
          <HStack>
            {status}
            <Spacer />
            {brand}
          </HStack>
          <Spacer />
          {titles(18, 14)}
        </VStack>
      </HStack>
    );
  }

  return (
    <Background modifiers={[base, open]}>
      {content}
      <Background.Content>{backdrop}</Background.Content>
    </Background>
  );
};

const widget = createWidget<Props>('DixFM', DixWidget, {
  title: 'Dix FM',
  artist: 'Radio en vivo',
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

const STALE_MS = 10 * 60 * 1000;

export function updateWidget(state: WidgetState) {
  const ticket = ++latest;
  // 300 px bastan para el widget y respetan su límite de memoria.
  const artUrl = state.artUrl?.replace('600x600', '300x300');
  const push = () => {
    if (ticket !== latest) return;
    const props: Props = {
      title: state.title,
      artist: state.artist,
      live: state.live,
      art: art && art.url === artUrl ? art.path : undefined,
      logo: logoPath,
    };
    try {
      if (state.live) {
        // Si la app se cierra mientras suena, el widget deja de decir "En vivo" a los 10 minutos.
        widget.updateTimeline([
          { date: new Date(), props },
          { date: new Date(Date.now() + STALE_MS), props: { ...props, live: false } },
        ]);
      } else {
        widget.updateSnapshot(props);
      }
    } catch {
      // Sin extensión de widget (por ejemplo, en desarrollo).
    }
  };
  push();
  Promise.all([ensureLogo().catch(() => {}), ensureArt(artUrl).catch(() => {})]).then(push);
}
