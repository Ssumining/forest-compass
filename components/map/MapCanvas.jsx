'use client';
import 'leaflet/dist/leaflet.css';
import { Component, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import MapView from './MapView';

// react-leaflet은 window 의존 → 클라이언트에서만 로드 (Next 16 규약: ssr:false는 client comp에서).
const LeafletMapView = dynamic(() => import('./LeafletMapView'), { ssr: false });

// Leaflet import/마운트 예외 → SVG 폴백.
class MapErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export default function MapCanvas(props) {
  const [offline, setOffline] = useState(false);
  const [ready, setReady] = useState(false);

  // 안정 콜백 — LeafletMapView의 타임아웃 가드 useEffect가 재렌더마다 리셋되지 않도록.
  const handleReady = useCallback(() => setReady(true), []);
  const handleOffline = useCallback(() => setOffline(true), []);

  // 타일 실패/타임아웃 → 영구 SVG 폴백.
  if (offline) return <MapView {...props} />;

  return (
    <div className="absolute inset-0">
      {/* 첫 타일 로드 전까지 SVG를 뒤에 깔아 빈 화면 방지 */}
      {!ready && <MapView {...props} />}
      <MapErrorBoundary fallback={<MapView {...props} />}>
        <LeafletMapView {...props} onReady={handleReady} onOffline={handleOffline} />
      </MapErrorBoundary>
    </div>
  );
}
