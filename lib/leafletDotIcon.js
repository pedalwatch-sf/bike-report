// A small colored circle marker, built from a CSS custom property color
// (e.g. 'var(--teal)') rather than an image asset. `L` is passed in since
// Leaflet is always dynamically imported client-side.
export function dotIcon(L, color) {
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid rgba(0,0,0,0.45);box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}
