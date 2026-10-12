import { useCallback, useEffect, useRef, useState } from 'react';
import { localDestinationSuggestions, mergeDestinationSuggestions } from '../lib/destinationAutocomplete';
import { resolveDestinationSuggestion, searchDestinationSuggestions } from '../lib/googleMaps';

export function useDestinationAutocomplete(query) {
  const [state, setState] = useState({ suggestions: [], loading: false, error: '', selectingId: '' });
  const sessionToken = useRef(null);
  const newestRequest = useRef(0);

  useEffect(() => {
    const input = query.trim();
    const requestId = ++newestRequest.current;
    if (!input) {
      setState({ suggestions: [], loading: false, error: '', selectingId: '' });
      return undefined;
    }

    const localSuggestions = localDestinationSuggestions(input);
    setState({ suggestions: localSuggestions, loading: true, error: '', selectingId: '' });
    const timer = window.setTimeout(() => {
      searchDestinationSuggestions(input, sessionToken.current)
        .then((result) => {
          if (requestId !== newestRequest.current) return;
          sessionToken.current = result.sessionToken;
          setState({
            suggestions: mergeDestinationSuggestions(result.suggestions, localSuggestions),
            loading: false,
            error: '',
            selectingId: '',
          });
        })
        .catch(() => {
          if (requestId !== newestRequest.current) return;
          setState({
            suggestions: localSuggestions,
            loading: false,
            error: localSuggestions.length
              ? ''
              : 'Live city suggestions are unavailable. You can still search for what you typed.',
            selectingId: '',
          });
        });
    }, 140);

    return () => window.clearTimeout(timer);
  }, [query]);

  const selectSuggestion = useCallback(async (suggestion) => {
    setState((current) => ({ ...current, selectingId: suggestion.id, error: '' }));
    try {
      const destination = await resolveDestinationSuggestion(suggestion);
      sessionToken.current = null;
      setState((current) => ({ ...current, selectingId: '' }));
      return destination;
    } catch {
      setState((current) => ({
        ...current,
        selectingId: '',
        error: 'That city could not be opened. Choose another suggestion or try again.',
      }));
      return null;
    }
  }, []);

  return { ...state, selectSuggestion };
}
