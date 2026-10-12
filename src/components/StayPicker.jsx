import { ArrowRight, BedDouble, MapPin, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { searchStayPlaces } from '../lib/googleMaps';

export function StayPicker({ cityName, stay, loading, error, notice, onSave, onClear, persistedToAccount, searchSeed = '' }) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const requestNumber = useRef(0);

  useEffect(() => {
    if (!searchSeed) return;
    setQuery(searchSeed);
    setEditing(true);
  }, [searchSeed]);

  useEffect(() => {
    const cleanQuery = query.trim();
    if ((!editing && stay) || cleanQuery.length < 2) {
      setResults([]);
      setSearching(false);
      if (cleanQuery.length < 2) setSearchError('');
      return undefined;
    }

    const currentRequest = requestNumber.current + 1;
    requestNumber.current = currentRequest;
    setSearching(true);
    setSearchError('');
    const timer = window.setTimeout(() => {
      searchStayPlaces({ cityName, query: cleanQuery }).then((places) => {
        if (requestNumber.current !== currentRequest) return;
        setResults(places);
        setSearching(false);
      }).catch((requestError) => {
        if (requestNumber.current !== currentRequest) return;
        setResults([]);
        setSearching(false);
        setSearchError(requestError.message || 'That location could not be found.');
      });
    }, 260);
    return () => window.clearTimeout(timer);
  }, [cityName, editing, query, stay]);

  const handleSearch = (event) => {
    event.preventDefault();
    if (results[0]) selectStay(results[0]);
  };

  const selectStay = async (place) => {
    await onSave(place);
    setEditing(false);
    setResults([]);
    setQuery('');
  };

  return (
    <section className="stay-picker" aria-labelledby="stay-picker-title">
      <div className="stay-picker__heading">
        <BedDouble size={19} strokeWidth={1.5} aria-hidden="true" />
        <div><h2 id="stay-picker-title">Where are you staying?</h2><p>Set a home base to see what is realistically nearby.</p></div>
      </div>

      {loading ? <div className="stay-picker__loading"><span className="saved-state__pulse" />Loading your stay…</div> : null}
      {!loading && stay && !editing ? (
        <div className="stay-picker__current">
          <MapPin size={18} aria-hidden="true" />
          <div><strong>{stay.name}</strong><span>{stay.address}</span><small>{persistedToAccount ? 'Saved to your account' : 'Saved on this device'}</small></div>
          <button type="button" onClick={() => setEditing(true)}>Change</button>
          <button type="button" onClick={onClear} aria-label="Remove saved stay"><X size={16} /></button>
        </div>
      ) : null}

      {!loading && (!stay || editing) ? (
        <form className="stay-picker__form" onSubmit={handleSearch}>
          <label><Search size={17} aria-hidden="true" /><span className="sr-only">Hotel, address, or neighborhood</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Start typing a hotel or address in ${cityName}`} autoComplete="off" aria-autocomplete="list" aria-controls="stay-results" aria-expanded={results.length > 0} /></label>
          {searching ? <span className="stay-picker__searching" role="status"><span className="saved-state__pulse" />Searching…</span> : null}
          {stay ? <button className="stay-picker__cancel" type="button" onClick={() => { setEditing(false); setResults([]); }}>Cancel</button> : null}
        </form>
      ) : null}

      {results.length ? (
        <div className="stay-results" id="stay-results" role="listbox" aria-label="Stay suggestions">
          {results.map((place) => <button type="button" key={place.id} onClick={() => selectStay(place)}><MapPin size={16} /><span><strong>{place.name}</strong><small>{place.address}</small></span><ArrowRight size={15} aria-hidden="true" /></button>)}
        </div>
      ) : null}
      {!searching && query.trim().length >= 2 && !results.length && !searchError ? <p className="stay-picker__empty">No matching stays yet. Try a hotel name, address, or neighborhood.</p> : null}
      {notice && stay && !error ? <p className="stay-picker__note" role="status">{notice}</p> : null}
      {searchError || error ? <p className="stay-picker__error" role="alert">{searchError || error}</p> : null}
    </section>
  );
}
