import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps } from '../lib/googleMaps';

function removeMarker(record) {
  if (record.clickHandler) record.marker.removeEventListener('gmp-click', record.clickHandler);
  record.marker.map = null;
}

function getCoordinateKey(id, coordinates) {
  if (!coordinates) return null;
  return `${id}:${Number(coordinates.lat).toFixed(6)},${Number(coordinates.lng).toFixed(6)}`;
}

export function PlacesMap({ places, selectedId, onSelect, destinationName, center, viewport, loading, error, stay = null }) {
  const canvasRef = useRef(null);
  const mapRef = useRef(null);
  const markerLibraryRef = useRef(null);
  const markersRef = useRef(new Map());
  const fittedCoordinatesRef = useRef('');
  const onSelectRef = useRef(onSelect);
  const selectedIdRef = useRef(selectedId);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState('');
  const selected = places.find((place) => place.id === selectedId);
  const previewMeta = selected
    ? [selected.rating ? `★ ${selected.rating}` : null, selected.distance, selected.category].filter(Boolean)
    : [];

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    markersRef.current.forEach((record) => {
      if (record.isStay) return;
      const isSelected = record.id === selectedId;
      if (record.isSelected === isSelected) return;
      record.pin.background = isSelected ? '#805139' : '#292925';
      record.pin.scale = isSelected ? 1.18 : 1;
      record.marker.zIndex = isSelected ? 1000 : record.index + 1;
      record.isSelected = isSelected;
    });
  }, [selectedId]);

  useEffect(() => {
    let active = true;
    if (!canvasRef.current || !center || error) return undefined;

    loadGoogleMaps()
      .then(async () => {
        const [{ Map }, { AdvancedMarkerElement, PinElement }] = await Promise.all([
          window.google.maps.importLibrary('maps'),
          window.google.maps.importLibrary('marker'),
        ]);
        if (!active || !canvasRef.current) return;

        const map = mapRef.current ?? new Map(canvasRef.current, {
          center,
          zoom: 12,
          mapId: 'DEMO_MAP_ID',
          clickableIcons: false,
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
        });
        mapRef.current = map;
        markerLibraryRef.current = { AdvancedMarkerElement, PinElement };
        setMapError('');
        setMapReady(true);
      })
      .catch((loadError) => {
        if (active) setMapError(loadError.message);
      });

    return () => {
      active = false;
    };
  }, [center?.lat, center?.lng, error]);

  useEffect(() => {
    const map = mapRef.current;
    const markerLibrary = markerLibraryRef.current;
    if (!mapReady || !map || !markerLibrary || error) return;

    const { AdvancedMarkerElement, PinElement } = markerLibrary;
    const markerRecords = markersRef.current;
    const nextMarkerIds = new Set();

    places.forEach((place, index) => {
      if (!place.coordinates) return;

      nextMarkerIds.add(place.id);
      const isSelected = place.id === selectedIdRef.current;
      const existing = markerRecords.get(place.id);
      const nextCoordinateKey = getCoordinateKey(place.id, place.coordinates);

      if (existing) {
        if (existing.coordinateKey !== nextCoordinateKey) {
          existing.marker.position = place.coordinates;
          existing.coordinateKey = nextCoordinateKey;
        }
        if (existing.title !== place.name) {
          existing.marker.title = place.name;
          existing.title = place.name;
        }
        if (existing.index !== index) {
          existing.index = index;
          existing.pin.glyphText = String(index + 1);
          existing.marker.zIndex = isSelected ? 1000 : index + 1;
        }
        if (existing.isSelected !== isSelected) {
          existing.pin.background = isSelected ? '#805139' : '#292925';
          existing.pin.scale = isSelected ? 1.18 : 1;
          existing.marker.zIndex = isSelected ? 1000 : index + 1;
          existing.isSelected = isSelected;
        }
        return;
      }

      const pin = new PinElement({
        glyphText: String(index + 1),
        background: isSelected ? '#805139' : '#292925',
        borderColor: '#faf7f0',
        glyphColor: '#ffffff',
        scale: isSelected ? 1.18 : 1,
      });
      const marker = new AdvancedMarkerElement({
        map,
        position: place.coordinates,
        title: place.name,
        content: pin,
        gmpClickable: true,
        zIndex: isSelected ? 1000 : index + 1,
      });
      const clickHandler = () => onSelectRef.current(place.id);
      marker.addEventListener('gmp-click', clickHandler);
      markerRecords.set(place.id, {
        id: place.id,
        index,
        marker,
        pin,
        clickHandler,
        isStay: false,
        isSelected,
        coordinateKey: nextCoordinateKey,
        title: place.name,
      });
    });

    if (stay?.coordinates) {
      nextMarkerIds.add('__stay');
      const existingStay = markerRecords.get('__stay');
      const stayCoordinateKey = getCoordinateKey('__stay', stay.coordinates);
      const stayTitle = `Your stay: ${stay.name}`;

      if (existingStay) {
        if (existingStay.coordinateKey !== stayCoordinateKey) {
          existingStay.marker.position = stay.coordinates;
          existingStay.coordinateKey = stayCoordinateKey;
        }
        if (existingStay.title !== stayTitle) {
          existingStay.marker.title = stayTitle;
          existingStay.title = stayTitle;
        }
      } else {
        const pin = new PinElement({
          glyphText: 'S',
          background: '#667061',
          borderColor: '#faf7f0',
          glyphColor: '#ffffff',
          scale: 1.12,
        });
        const marker = new AdvancedMarkerElement({
          map,
          position: stay.coordinates,
          title: stayTitle,
          content: pin,
          zIndex: 900,
        });
        markerRecords.set('__stay', {
          id: '__stay',
          index: -1,
          marker,
          pin,
          clickHandler: null,
          isStay: true,
          coordinateKey: stayCoordinateKey,
          title: stayTitle,
        });
      }
    }

    markerRecords.forEach((record, id) => {
      if (nextMarkerIds.has(id)) return;
      removeMarker(record);
      markerRecords.delete(id);
    });

    const coordinateKey = [
      ...places.map((place) => getCoordinateKey(place.id, place.coordinates)).filter(Boolean),
      getCoordinateKey('__stay', stay?.coordinates),
    ].filter(Boolean).sort().join('|');

    if (coordinateKey === fittedCoordinatesRef.current) return;
    fittedCoordinatesRef.current = coordinateKey;

    const placesWithCoordinates = places.filter((place) => place.coordinates);
    if (placesWithCoordinates.length > 1) {
      const bounds = new window.google.maps.LatLngBounds();
      placesWithCoordinates.forEach((place) => bounds.extend(place.coordinates));
      if (stay?.coordinates) bounds.extend(stay.coordinates);
      map.fitBounds(bounds, 48);
    } else if (viewport) {
      map.fitBounds(viewport, 48);
    } else {
      map.setCenter(center);
      map.setZoom(12);
    }
  }, [center, error, mapReady, places, stay, viewport]);

  return (
    <section className="places-map" aria-label={`Map of ${destinationName} places`}>
      <div className="places-map__canvas" ref={canvasRef} />
      {loading ? <div className="places-map__state"><span className="saved-state__pulse" />Finding places around {destinationName}…</div> : null}
      {error || mapError ? <div className="places-map__state places-map__state--error">Map unavailable until Google Places is configured.</div> : null}
      {selected ? (
        <div className="map-preview">
          {selected.image ? <img src={selected.image} alt="" referrerPolicy="origin" /> : <span className="map-preview__fallback" />}
          <div><strong>{selected.name}</strong>{previewMeta.length ? <span>{previewMeta.join(' · ')}</span> : null}</div>
          <button type="button" aria-label="Close map preview" onClick={() => onSelect(null)}><X size={16} /></button>
        </div>
      ) : null}
    </section>
  );
}
