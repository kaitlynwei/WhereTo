import { destinationHref, destinationSlug } from './navigation';

function definedEntries(record) {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => (
    value !== undefined && value !== null && value !== ''
  )));
}

export function savedDestination(destination) {
  const slug = destinationSlug(destination.name);

  return definedEntries({
    id: `destination-${slug}`,
    type: 'destination',
    name: destination.name,
    destination: destination.name,
    destinationId: slug,
    country: destination.country,
    category: destination.categories?.[0],
    categories: destination.categories,
    image: destination.image,
    href: destinationHref(destination.name),
  });
}

export function savedGooglePlace(place, guide) {
  const destination = guide.displayName ?? guide.name;
  const destinationId = destinationSlug(destination);
  const firestoreRecord = definedEntries({
    id: place.id,
    placeId: place.id,
    type: 'google-place',
    destination,
    destinationId,
    href: destinationHref(destination, { city: destination }),
  });

  return {
    ...place,
    type: 'google-place',
    destination,
    destinationId,
    href: firestoreRecord.href,
    firestoreRecord,
  };
}
