// El widget de pantalla de inicio solo existe en iOS (ver widget.ios.tsx).
export type DixWidgetProps = { title: string; artist: string; live: boolean };

const widget: { updateSnapshot(props: DixWidgetProps): void } | null = null;
export default widget;
