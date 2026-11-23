import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, Linking, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from './config';
import type { Song } from './nowPlaying';
import { Glass, Press, tap } from './ui';

const logo = require('../assets/logo.png');
const ORIENTATIONS = ['portrait', 'landscape'] as const;
const timeFmt = new Intl.DateTimeFormat('es', { hour: 'numeric', minute: '2-digit' });

export function SongsSheet({
  visible,
  onClose,
  history,
  favs,
  onRemoveFav,
}: {
  visible: boolean;
  onClose: () => void;
  history: Song[];
  favs: Song[];
  onRemoveFav: (song: Song) => void;
}) {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<'recent' | 'favs'>('recent');
  const items = tab === 'recent' ? history : favs;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" supportedOrientations={[...ORIENTATIONS]} onRequestClose={onClose}>
      <View style={[styles.sheet, { paddingTop: Platform.OS === 'ios' ? 10 : insets.top + 8 }]}>
        <View style={styles.head}>
          <View style={styles.tabs} accessibilityRole="tablist">
            {(['recent', 'favs'] as const).map((id) => (
              <Pressable
                key={id}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === id }}
                onPress={() => setTab(id)}
                style={[styles.tab, tab === id && styles.tabOn]}>
                <Text style={[styles.tabText, tab === id && styles.tabTextOn]}>{id === 'recent' ? 'Recientes' : 'Favoritas'}</Text>
              </Pressable>
            ))}
          </View>
          <Press onPress={onClose} label="Cerrar" style={styles.close}>
            <Ionicons name="close" size={22} color="#fff" />
          </Press>
        </View>

        <FlatList
          data={items}
          keyExtractor={(item) => item.key}
          contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: insets.bottom + 24, width: '100%', maxWidth: 640, alignSelf: 'center' }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {tab === 'recent'
                ? 'Las canciones que suenen en Dix FM aparecerán aquí.'
                : 'Toca el corazón mientras suena una canción para guardarla aquí.'}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.row, pressed && item.url ? styles.rowPressed : null]}
              disabled={!item.url}
              accessibilityRole={item.url ? 'link' : 'text'}
              accessibilityLabel={`${item.title}, ${item.artist}`}
              accessibilityHint={item.url ? 'Abre la canción en Apple Music' : undefined}
              onPress={() => item.url && Linking.openURL(item.url).catch(() => {})}>
              {item.thumb ? (
                <Image source={{ uri: item.thumb }} style={styles.thumb} transition={200} />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  <Image source={logo} style={styles.thumbLogo} contentFit="contain" />
                </View>
              )}
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.rowArtist} numberOfLines={1}>
                  {item.artist}
                </Text>
              </View>
              {tab === 'recent' ? (
                <Text style={styles.time}>{timeFmt.format(item.t)}</Text>
              ) : (
                <Press onPress={() => onRemoveFav(item)} label={`Quitar ${item.title} de favoritas`} style={styles.remove}>
                  <Ionicons name="heart" size={22} color={colors.live} />
                </Press>
              )}
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

const SLEEP_OPTIONS = [
  { minutes: 15, label: '15 minutos' },
  { minutes: 30, label: '30 minutos' },
  { minutes: 60, label: '1 hora' },
];

function Option({ label, color, first, onPress }: { label: string; color?: string; first?: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.option, !first && styles.optionLine, pressed && styles.optionPressed]}
      onPress={() => {
        tap();
        onPress();
      }}>
      <Text style={[styles.optionText, color ? { color } : null]}>{label}</Text>
    </Pressable>
  );
}

/** Temporizador de apagado: hoja de cristal que deja ver la carátula detrás. */
export function SleepSheet({
  visible,
  active,
  minutesLeft,
  onPick,
  onClose,
}: {
  visible: boolean;
  active: boolean;
  minutesLeft: number;
  onPick: (minutes: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      supportedOrientations={[...ORIENTATIONS]}
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Cerrar" accessibilityRole="button" />
      <View style={[styles.sleep, { bottom: insets.bottom + 12 }]} pointerEvents="box-none">
        <Glass interactive={false} solid="#2a2242" style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="moon" size={20} color="#fff" />
            <Text style={styles.cardTitle}>Apagar la radio en</Text>
            {active && <Text style={styles.cardNote}>Quedan {minutesLeft} min</Text>}
          </View>
          {SLEEP_OPTIONS.map((option) => (
            <Option key={option.minutes} label={option.label} onPress={() => onPick(option.minutes)} />
          ))}
          {active && <Option label="Quitar temporizador" color="#ff6482" onPress={() => onPick(0)} />}
        </Glass>
        <Glass interactive={false} solid="#2a2242" style={[styles.card, styles.cancel]}>
          <Option first label="Cancelar" onPress={onClose} />
        </Glass>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.sheet },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  tabs: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 999, backgroundColor: colors.glass },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 999 },
  tabOn: { backgroundColor: '#fff' },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.text2 },
  tabTextOn: { color: colors.ink },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glass },
  empty: { paddingVertical: 56, paddingHorizontal: 28, textAlign: 'center', color: colors.text2, fontSize: 16, lineHeight: 23 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 8, borderRadius: 14 },
  rowPressed: { backgroundColor: colors.glass },
  thumb: { width: 52, height: 52, borderRadius: 9 },
  thumbEmpty: { backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  thumbLogo: { width: 36, height: 16 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  rowArtist: { color: colors.text2, fontSize: 14, marginTop: 1 },
  time: { color: colors.text3, fontSize: 13, fontVariant: ['tabular-nums'] },
  remove: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)' },
  sleep: { position: 'absolute', alignSelf: 'center', width: '94%', maxWidth: 400, gap: 8 },
  card: { borderRadius: 28, overflow: 'hidden' },
  cancel: { borderRadius: 22 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 22, paddingTop: 20, paddingBottom: 14 },
  cardTitle: { flex: 1, color: '#fff', fontSize: 17, fontWeight: '700' },
  cardNote: { color: colors.text2, fontSize: 14, fontVariant: ['tabular-nums'] },
  option: { paddingVertical: 16, paddingHorizontal: 22, alignItems: 'center' },
  optionLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.22)' },
  optionPressed: { backgroundColor: 'rgba(255,255,255,0.12)' },
  optionText: { color: '#fff', fontSize: 17, fontWeight: '500' },
});
