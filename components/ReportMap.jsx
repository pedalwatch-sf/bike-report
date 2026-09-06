'use client';

import React, { useEffect, useRef, useState } from 'react';
import { SF_CENTER } from '../lib/constants';
import { dotIcon } from '../lib/leafletDotIcon';

export default function ReportMap({ reports, loading, total }) {
  const container = useRef(null);
  const instance = useRef(null);
  const layers = useRef(null);
  const leaflet = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let map;
    import('leaflet').then(({ default: L }) => {
      if (cancelled || !container.current) return;
      leaflet.current = L;
      map = L.map(container.current, { scrollWheelZoom: false }).setView(SF_CENTER, 12);
      const tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
      tiles.on('tileerror', () => { if (!cancelled) setFailed(true); });
      layers.current = L.featureGroup().addTo(map);
      instance.current = map;
      setReady(true);
    }).catch(() => { if (!cancelled) setFailed(true); });
    return () => {
      cancelled = true;
      map?.remove();
      instance.current = null;
      layers.current = null;
    };
  }, [attempt]);

  useEffect(() => {
    if (!ready || !layers.current) return;
    const L = leaflet.current;
    layers.current.clearLayers();
    reports.forEach((report) => {
      if (!Number.isFinite(report.lat) || !Number.isFinite(report.lng)) return;
      // DOM text keeps community-authored content out of HTML parsing.
      const popup = document.createElement('div');
      const title = document.createElement('strong');
      title.textContent = report.title;
      const link = document.createElement('a');
      link.href = `/report/${encodeURIComponent(report.id)}`;
      link.textContent = 'View report →';
      popup.append(title, document.createElement('br'), link);
      L.marker([report.lat, report.lng], {
        icon: dotIcon(L, report.status === 'resolved' ? 'var(--yellow)' : 'var(--teal)'),
        title: report.title,
        alt: report.title,
      }).addTo(layers.current).bindPopup(popup);
    });
  }, [ready, reports]);

  function fitReports() {
    const bounds = layers.current?.getBounds();
    if (bounds?.isValid()) instance.current.fitBounds(bounds, { padding: [35, 35], maxZoom: 16 });
    else instance.current?.setView(SF_CENTER, 12);
  }

  return (
    <section className="map-panel" aria-label="Map of loaded reports">
      <div className="map-toolbar"><span>San Francisco</span><button type="button" className="btn outline" onClick={fitReports} disabled={!ready}>Fit reports</button></div>
      <div ref={container} className="browse-map" aria-label="Report locations. All reports are also available in the list." />
      {failed && <div className="map-notice" role="alert">Map unavailable. You can still browse the reports.<button className="btn outline" onClick={() => { setReady(false); setFailed(false); setAttempt((value) => value + 1); }}>Retry map</button></div>}
      <div className="map-key"><span><i className="stat-dot" style={{ background: 'var(--teal)' }} />Active</span><span><i className="stat-dot" style={{ background: 'var(--yellow)' }} />Resolved</span></div>
      <p className="hint map-caption">{loading ? 'Loading matching reports…' : `Map shows locations for ${reports.length} loaded report${reports.length === 1 ? '' : 's'}.`}{total > reports.length && ' Load more below to see additional locations.'}</p>
    </section>
  );
}
