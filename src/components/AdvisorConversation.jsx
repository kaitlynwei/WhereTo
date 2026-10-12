import { AlertCircle, ArrowRight, CornerDownRight, MapPin, RefreshCw, Send, Sparkles, Star } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { askWhereTo, getAdvisorStatus } from '../lib/advisor';
import { destinationHref } from '../lib/navigation';
import { fetchNeighborhoodPreviews, searchPlacesForPrompt } from '../lib/googleMaps';

const discoveryPrompts = [
  'Warm, walkable, great food, and not too expensive',
  'A quiet coastal trip with good local food',
  'Art, nightlife, and easy public transportation',
];

const destinationPrompts = [
  'Architecture and food, but not many museums',
  'What is good near where I am staying?',
  'Something cheaper and more local',
  'Where should I stay for food and walkability?',
];

function cleanReplyText(value = '') {
  return String(value)
    .replace(/\*\*/g, '')
    .replace(/#{1,6}\s*/g, '')
    .replace(/\s*\(Place ID:[^)]+\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function AdvisorConversation({
  mode = 'discovery', destination = '', places = [], stay = null, preferences = null,
  fallbackImage = '', onRecommendations, onNeighborhoodPick,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState(null);
  const transcriptEndRef = useRef(null);
  const lastPromptRef = useRef('');
  const prompts = mode === 'destination' ? destinationPrompts : discoveryPrompts;

  useEffect(() => { getAdvisorStatus().then((status) => setConfigured(Boolean(status.configured))); }, []);
  useEffect(() => {
    if (messages.length > 0 || sending) transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, sending]);

  const sendPrompt = async (promptValue, { appendUser = true } = {}) => {
    const prompt = promptValue.trim();
    if (!prompt || sending) return;
    const userMessage = { role: 'user', content: prompt };
    const transcript = appendUser ? [...messages, userMessage] : messages;
    if (appendUser) setMessages(transcript);
    lastPromptRef.current = prompt;
    setInput('');
    setError('');
    setSending(true);

    try {
      let candidatePlaces = places;
      if (mode === 'destination') {
        try {
          candidatePlaces = await searchPlacesForPrompt({ cityName: destination, prompt, fallbackImage, stay });
        } catch {
          candidatePlaces = places;
        }
      }
      const result = await askWhereTo({
        mode,
        destination,
        stay,
        preferences,
        places: candidatePlaces,
        messages: transcript.map(({ role, content }) => ({ role, content })),
      });
      const reasons = new Map((result.placeRecommendations ?? []).map((item) => [item.placeId, item.reason]));
      const recommendedPlaces = (result.placeRecommendations ?? [])
        .map((item) => candidatePlaces.find((place) => place.id === item.placeId))
        .filter(Boolean)
        .map((place) => ({ ...place, aiReason: reasons.get(place.id) }));
      const messageId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const assistantMessage = {
        id: messageId,
        role: 'assistant',
        content: cleanReplyText(result.reply),
        data: {
          ...result,
          recommendedPlaces,
          neighborhoods: (result.neighborhoods ?? []).map((area) => ({ ...area, imageLoading: true })),
        },
      };
      setMessages((current) => [...current, assistantMessage]);

      if (mode === 'destination' && result.placeRecommendations?.length) {
        if (recommendedPlaces.length) onRecommendations?.(recommendedPlaces);
      }

      if (mode === 'destination' && result.neighborhoods?.length) {
        fetchNeighborhoodPreviews({
          cityName: destination,
          neighborhoods: result.neighborhoods.map((area) => area.name),
        }).then((previews) => {
          const previewByName = new Map(previews.map((preview) => [preview.name, preview]));
          setMessages((current) => current.map((message) => (
            message.id === messageId ? {
              ...message,
              data: {
                ...message.data,
                neighborhoods: message.data.neighborhoods.map((area) => ({
                  ...area,
                  preview: previewByName.get(area.name),
                  imageLoading: false,
                })),
              },
            } : message
          )));
        }).catch(() => {
          setMessages((current) => current.map((message) => (
            message.id === messageId ? {
              ...message,
              data: {
                ...message.data,
                neighborhoods: message.data.neighborhoods.map((area) => ({ ...area, imageLoading: false })),
              },
            } : message
          )));
        });
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    sendPrompt(input);
  };

  return (
    <section className={`advisor-conversation advisor-conversation--${mode}`} aria-label="Ask WhereTo travel advisor">
      <div className="advisor-conversation__intro">
        <Sparkles size={19} strokeWidth={1.5} aria-hidden="true" />
        <div>
          <h2>{mode === 'destination' ? `Ask about ${destination}` : 'Describe the trip you want'}</h2>
          <p>{mode === 'destination' ? 'Refine the live places, compare areas, or start from where you are staying.' : 'Use your own words. WhereTo will ask only what it needs, then narrow the world down.'}</p>
        </div>
      </div>

      {messages.length === 0 ? (
        <div className="advisor-prompts" aria-label="Example questions">
          {prompts.map((prompt) => <button type="button" key={prompt} onClick={() => sendPrompt(prompt)} disabled={!configured || sending}>{prompt}<ArrowRight size={15} /></button>)}
        </div>
      ) : null}

      <div className="advisor-transcript" aria-live="polite">
        {messages.map((message, index) => (
          <article className={`advisor-message advisor-message--${message.role}`} key={`${message.role}-${index}`}>
            <span>{message.role === 'user' ? 'You' : 'WhereTo'}</span>
            <div>
              <p>{message.content}</p>
              {message.data?.destinations?.length ? (
                <div className="advisor-destinations">
                  {message.data.destinations.map((item) => (
                    <a href={destinationHref(item.name, { city: item.name })} key={`${item.name}-${item.country}`}>
                      <div><h3>{item.name}</h3><span>{item.country}</span></div>
                      <p>{item.reason}</p>
                      <small>{item.consideration}</small>
                      <i>{item.tags.join(' · ')}</i>
                    </a>
                  ))}
                </div>
              ) : null}
              {message.data?.neighborhoods?.length ? (
                <div className="advisor-neighborhoods">
                  {message.data.neighborhoods.map((area) => (
                    <article key={area.name}>
                      {area.preview?.image || area.imageLoading ? (
                        <figure className={area.imageLoading ? 'is-loading' : ''}>
                          {area.preview?.image ? <img src={area.preview.image} alt={area.preview.imageAlt} referrerPolicy="origin" /> : null}
                          {area.preview?.photoAttributions?.length ? (
                            <figcaption>Photo: {area.preview.photoAttributions.map((author) => author.name).join(', ')}</figcaption>
                          ) : null}
                        </figure>
                      ) : null}
                      <div>
                        <header><h3>{area.name}</h3><span>{area.bestFor}</span></header>
                        <p>{area.reason}</p>
                        <small>Worth knowing: {area.tradeoff}</small>
                        {onNeighborhoodPick ? <button type="button" onClick={() => onNeighborhoodPick(area.name)}>Use as a stay area <CornerDownRight size={14} /></button> : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
              {message.data?.recommendedPlaces?.length ? (
                <div className="advisor-place-results" aria-label="Recommended places">
                  {message.data.recommendedPlaces.map((place) => (
                    <article key={place.id}>
                      <div className="advisor-place-results__image">
                        {place.image ? <img src={place.image} alt={place.imageAlt || place.name} referrerPolicy="origin" /> : <span><MapPin size={19} aria-hidden="true" /></span>}
                      </div>
                      <div>
                        <span>{place.category}</span>
                        <h3>{place.name}</h3>
                        <p>{place.aiReason}</p>
                        {place.rating ? <small><Star size={12} fill="currentColor" aria-hidden="true" />{place.rating}{place.userRatingCount ? ` · ${place.userRatingCount.toLocaleString()} reviews` : ''}</small> : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : null}
              {message.data?.placeRecommendations?.length ? <p className="advisor-result-note">The live place list and map now match these recommendations.</p> : null}
              {message.data?.followUpQuestions?.length ? (
                <div className="advisor-followups">
                  {message.data.followUpQuestions.map((question) => <button type="button" key={question} onClick={() => setInput(question)} disabled={sending}>{question}</button>)}
                </div>
              ) : null}
            </div>
          </article>
        ))}
        {sending ? <div className="advisor-thinking" role="status"><span className="saved-state__pulse" />WhereTo is narrowing it down…</div> : null}
        {error && !sending ? (
          <div className="advisor-failure" role="alert">
            <AlertCircle size={18} aria-hidden="true" />
            <div><strong>That answer did not finish.</strong><p>{error}</p></div>
            <button type="button" onClick={() => sendPrompt(lastPromptRef.current, { appendUser: false })}><RefreshCw size={14} />Try again</button>
          </div>
        ) : null}
        <div className="advisor-transcript__end" ref={transcriptEndRef} aria-hidden="true" />
      </div>

      {configured === false ? (
        <div className="advisor-config" role="status"><strong>The travel editor needs its OpenAI key.</strong><span>Add <code>OPENAI_API_KEY</code> to <code>.env</code>, then restart WhereTo.</span></div>
      ) : null}
      <form className="advisor-composer" onSubmit={handleSubmit}>
        <div className="advisor-composer__heading">
          <label htmlFor={`advisor-reply-${mode}`}>{messages.length ? 'Reply to WhereTo' : 'Ask WhereTo'}</label>
          <span>Enter to send · Shift + Enter for a new line</span>
        </div>
        <textarea id={`advisor-reply-${mode}`} value={input} onChange={(event) => setInput(event.target.value)} placeholder={messages.length ? 'Type your answer here…' : mode === 'destination' ? `What would make ${destination} feel right?` : 'I want somewhere warm, walkable, with great food…'} rows={3} disabled={!configured || sending} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendPrompt(input); } }} />
        <button type="submit" disabled={!configured || sending || !input.trim()} aria-label="Send reply to WhereTo"><Send size={18} /><span>Send</span></button>
      </form>
      <p className="advisor-disclaimer">Recommendations are a discovery starting point. Confirm current access, hours, prices, and transportation before you go.</p>
    </section>
  );
}
