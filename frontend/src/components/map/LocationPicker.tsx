import React, { useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import '../map/leafletIconFix';
import { LocationIcon } from '../common/Icons';

const DEFAULT_CENTER: [number, number] = [19.076, 72.8777]; // Mumbai, used only as a fallback map center

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function LocationPicker({
  value,
  onChange,
}: {
  value: { lat: number; lng: number } | null;
  onChange: (lat: number, lng: number) => void;
}) {
  const [geoError, setGeoError] = useState('');
  const [locating, setLocating] = useState(false);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser. Please select a location on the map.');
      return;
    }
    setLocating(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onChange(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
      },
      () => {
        setGeoError('Location permission was denied. You can select a location manually on the map.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const center = value ? [value.lat, value.lng] : DEFAULT_CENTER;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-slate-500">Click on the map to set the exact location, or use your current location.</p>
        <button type="button" onClick={useCurrentLocation} className="btn-secondary text-xs" disabled={locating}>
          <LocationIcon size={14} /> {locating ? 'Locating...' : 'Use current location'}
        </button>
      </div>
      {geoError && <p className="mb-2 text-xs text-amber-600">{geoError}</p>}
      <div className="h-64 overflow-hidden rounded-lg border border-slate-200">
        <MapContainer center={center as [number, number]} zoom={value ? 16 : 12} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickHandler onPick={onChange} />
          {value && <Marker position={[value.lat, value.lng]} />}
        </MapContainer>
      </div>
      {value && (
        <p className="mt-1 text-xs text-slate-400">
          Selected: {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
        </p>
      )}
    </div>
  );
}
