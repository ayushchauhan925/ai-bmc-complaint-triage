import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { PRIORITY_MARKER_COLORS } from '../../utils/constants';
import type { MapPoint } from '../../utils/types';

function priorityIcon(priorityLevel: string) {
  const color = PRIORITY_MARKER_COLORS[priorityLevel as keyof typeof PRIORITY_MARKER_COLORS] || '#64748b';
  return L.divIcon({
    className: '',
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

export function MarkerClusterLayer({
  points,
  onSelect,
}: {
  points: MapPoint[];
  onSelect: (point: MapPoint) => void;
}) {
  const map = useMap();

  useEffect(() => {
    // @ts-expect-error - markerClusterGroup is added to L by the leaflet.markercluster plugin
    const clusterGroup = L.markerClusterGroup({ maxClusterRadius: 45 });

    points.forEach((point) => {
      const lat = Number(point.latitude);
      const lng = Number(point.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return;
      const marker = L.marker([lat, lng], { icon: priorityIcon(point.priority_level) });
      marker.on('click', () => onSelect(point));
      clusterGroup.addLayer(marker);
    });

    map.addLayer(clusterGroup);
    return () => {
      map.removeLayer(clusterGroup);
    };
  }, [map, points, onSelect]);

  return null;
}
