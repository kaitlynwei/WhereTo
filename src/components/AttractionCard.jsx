import { ArrowUpRight, ChevronDown, LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchGooglePlaceDetails } from '../lib/googleMaps';
import { fetchOfficialPrice } from '../lib/officialPrices';
import { reviewCountLabel } from '../lib/placeRanking';
import { SaveButton } from './SaveButton';

const priceDescriptions = {
  Free: 'Free according to Google Places.',
  '$': 'Generally inexpensive.',
  '$$': 'Moderately priced.',
  '$$$': 'Generally expensive.',
  '$$$$': 'Premium pricing.',
};

function activityGuidance(category = '') {
  const value = category.toLowerCase();
  if (value.includes('observation') || value.includes('viewpoint')) return 'Go for the main views and leave time to explore each viewing level. Sunset and evening slots may be busiest.';
  if (value.includes('museum') || value.includes('gallery')) return 'Start with the signature collection, then leave room for current exhibitions. Check timed-entry rules before arriving.';
  if (value.includes('park') || value.includes('garden')) return 'Walk the main paths, then branch into quieter areas and viewpoints. Weather and daylight can shape the visit.';
  if (value.includes('restaurant') || value.includes('food') || value.includes('market')) return 'Look over the current menu or vendors and check peak hours. Reservations may be useful at busy times.';
  if (value.includes('historical') || value.includes('landmark')) return 'See the landmark itself, then spend time in the surrounding streets to understand its setting.';
  if (value.includes('shopping') || value.includes('store')) return 'Browse the main spaces and nearby shops; opening hours may vary by individual business.';
  return 'Explore the main experience and its surroundings. Check current entry requirements and seasonal changes before visiting.';
}

export function AttractionCard({ attraction, selected, isSaved, isSaving = false, onSelect, onToggleSaved }) {
  const requestedPlaceRef = useRef('');
  const requestedPriceRef = useRef('');
  const [detailsState, setDetailsState] = useState({ placeId: '', details: null, loading: false, error: '' });
  const [officialPriceState, setOfficialPriceState] = useState({ key: '', result: null, loading: false, error: '' });
  const meta = [
    attraction.rating ? `★ ${attraction.rating}` : null,
    reviewCountLabel(attraction.userRatingCount),
    attraction.category,
    attraction.price,
  ].filter(Boolean);
  const details = [attraction.openingText, attraction.distance].filter(Boolean);
  const detailsId = `place-details-${String(attraction.id).replace(/[^a-zA-Z0-9_-]/g, '')}`;

  useEffect(() => {
    let active = true;
    if (!selected || requestedPlaceRef.current === attraction.id) return undefined;

    requestedPlaceRef.current = attraction.id;
    setDetailsState({ placeId: attraction.id, details: null, loading: true, error: '' });
    fetchGooglePlaceDetails(attraction.placeId ?? attraction.id)
      .then((placeDetails) => {
        if (active) setDetailsState({ placeId: attraction.id, details: placeDetails, loading: false, error: '' });
      })
      .catch(() => {
        if (active) setDetailsState({ placeId: attraction.id, details: null, loading: false, error: 'Live visit details could not load. Try closing and reopening this place.' });
      });

    return () => {
      active = false;
      requestedPlaceRef.current = '';
    };
  }, [attraction.id, attraction.placeId, selected]);

  const placeDetails = detailsState.details;
  const hasGooglePrice = Boolean(placeDetails?.priceRange || placeDetails?.price || attraction.price);

  useEffect(() => {
    let active = true;
    const websiteUrl = placeDetails?.websiteURI;
    const requestKey = `${attraction.id}::${websiteUrl ?? ''}`;
    if (!selected || hasGooglePrice || !websiteUrl || requestedPriceRef.current === requestKey) return undefined;

    requestedPriceRef.current = requestKey;
    setOfficialPriceState({ key: requestKey, result: null, loading: true, error: '' });
    fetchOfficialPrice({ websiteUrl, placeName: placeDetails.name || attraction.name })
      .then((result) => {
        if (active) setOfficialPriceState({ key: requestKey, result, loading: false, error: '' });
      })
      .catch((error) => {
        if (active) {
          requestedPriceRef.current = '';
          setOfficialPriceState({ key: requestKey, result: null, loading: false, error: error.message });
        }
      });

    return () => {
      active = false;
    };
  }, [attraction.id, attraction.name, hasGooglePrice, placeDetails, selected]);

  const officialPrice = officialPriceState.result?.status === 'found' ? officialPriceState.result : null;
  const isOfficialPriceLoading = !hasGooglePrice && officialPriceState.loading;
  const hasPrice = hasGooglePrice || Boolean(officialPrice);
  const priceCopy = useMemo(() => {
    if (placeDetails?.priceRange) return placeDetails.priceRange;
    if (placeDetails?.price) return priceDescriptions[placeDetails.price] ?? placeDetails.price;
    if (attraction.price) return priceDescriptions[attraction.price] ?? attraction.price;
    if (officialPrice?.display) return officialPrice.display;
    return '';
  }, [attraction.price, officialPrice, placeDetails]);

  const priceCheckedLabel = useMemo(() => {
    if (!officialPrice?.checkedAt) return '';
    try {
      return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(officialPrice.checkedAt));
    } catch {
      return '';
    }
  }, [officialPrice]);

  return (
    <article className={`attraction-card${selected ? ' attraction-card--selected' : ''}`}>
      <button className="attraction-card__main" type="button" onClick={onSelect} aria-pressed={selected} aria-expanded={selected} aria-controls={detailsId}>
        <div className="attraction-card__image">
          {attraction.image ? <img src={attraction.image} alt={attraction.imageAlt ?? attraction.name} loading="lazy" /> : <span aria-hidden="true" />}
          {attraction.photoAttributions?.length ? (
            <small className="photo-attribution">
              Photo: {attraction.photoAttributions.map((author, index) => (
                author.uri
                  ? <a href={author.uri} target="_blank" rel="noreferrer" key={author.name}>{index ? `, ${author.name}` : author.name}</a>
                  : <span key={author.name}>{index ? `, ${author.name}` : author.name}</span>
              ))}
            </small>
          ) : null}
        </div>
        <div className="attraction-card__copy">
          <div className="attraction-card__meta">{meta.map((item) => <span key={item}>{item}</span>)}</div>
          <h3>{attraction.name}</h3>
          {attraction.aiReason ? <p className="attraction-card__reason">{attraction.aiReason}</p> : null}
          <p>{attraction.description}</p>
          {details.length ? (
            <div className="attraction-card__status">
              {attraction.openingText ? <span>{attraction.openingText}</span> : null}
              {attraction.distance ? <strong className="attraction-card__proximity">{attraction.distance}</strong> : null}
            </div>
          ) : null}
          <span className="attraction-card__details-label">
            {selected ? 'Hide details' : 'View details'}
            <ChevronDown size={15} aria-hidden="true" />
          </span>
        </div>
      </button>
      <SaveButton label={attraction.name} isSaved={isSaved} disabled={isSaving} onClick={onToggleSaved} className="attraction-card__save" />
      {attraction.directionsHref ? (
        <a className="attraction-card__directions" href={attraction.directionsHref} target="_blank" rel="noreferrer">
          Walking route <ArrowUpRight size={13} />
        </a>
      ) : null}
      {selected ? (
        <section className="place-details" id={detailsId} aria-label={`Visit details for ${attraction.name}`}>
          {detailsState.loading ? (
            <div className="place-details__loading" role="status"><LoaderCircle aria-hidden="true" />Loading current hours and visit information…</div>
          ) : null}
          {detailsState.error ? <p className="place-details__error" role="alert">{detailsState.error}</p> : null}
          {placeDetails ? (
            <>
              <div className="place-details__intro">
                <div>
                  <h4>Why go</h4>
                  <p>{placeDetails.summary || `${attraction.name} is a ${attraction.category.toLowerCase()} worth considering while exploring the area.`}</p>
                </div>
                <div>
                  <h4>What to do</h4>
                  <p>{activityGuidance(attraction.category)}</p>
                </div>
              </div>
              <div className={`place-details__facts${hasPrice || isOfficialPriceLoading ? '' : ' place-details__facts--two'}`}>
                <div className="place-details__hours">
                  <h4>Hours</h4>
                  {placeDetails.openNow !== null ? <strong className={placeDetails.openNow ? 'is-open' : 'is-closed'}>{placeDetails.openNow ? 'Open now' : 'Closed now'}</strong> : null}
                  {placeDetails.openingHours.length ? (
                    <ul>{placeDetails.openingHours.map((hours) => <li key={hours}>{hours}</li>)}</ul>
                  ) : <p>Current opening hours are not listed.</p>}
                </div>
                {hasPrice ? (
                  <div>
                    <h4>Price</h4>
                    <p className="place-details__price">{priceCopy}</p>
                    {officialPrice ? (
                      <>
                        <small>From the official site{priceCheckedLabel ? ` · checked ${priceCheckedLabel}` : ''}. Prices can change.</small>
                        <a href={officialPrice.sourceUrl} target="_blank" rel="noreferrer">See live ticket options <ArrowUpRight size={13} /></a>
                      </>
                    ) : <small>Prices can change. Confirm before visiting.</small>}
                  </div>
                ) : isOfficialPriceLoading ? (
                  <div className="place-details__price-loading" role="status">
                    <h4>Price</h4>
                    <p><LoaderCircle aria-hidden="true" />Checking the official site…</p>
                  </div>
                ) : null}
                <div>
                  <h4>Plan your visit</h4>
                  <address>{placeDetails.address || attraction.address}</address>
                  {placeDetails.phone ? <a href={`tel:${placeDetails.phone}`}>{placeDetails.phone}</a> : null}
                  <div className="place-details__links">
                    {placeDetails.websiteURI ? <a href={placeDetails.websiteURI} target="_blank" rel="noreferrer">{hasPrice ? 'Official website' : 'Tickets & current prices'} <ArrowUpRight size={13} /></a> : null}
                    {placeDetails.googleMapsURI ? <a href={placeDetails.googleMapsURI} target="_blank" rel="noreferrer">Google Maps <ArrowUpRight size={13} /></a> : null}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}
