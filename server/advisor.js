import OpenAI from 'openai';
import { validateAdvisorResult } from './validation.js';

export const advisorSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    reply: { type: 'string' },
    stage: { type: 'string', enum: ['clarify', 'destinations', 'activities', 'stay'] },
    followUpQuestions: { type: 'array', items: { type: 'string' }, maxItems: 3 },
    destinations: {
      type: 'array', maxItems: 3, items: {
        type: 'object', additionalProperties: false,
        properties: {
          name: { type: 'string' }, country: { type: 'string' }, reason: { type: 'string' }, consideration: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' }, maxItems: 4 },
        },
        required: ['name', 'country', 'reason', 'consideration', 'tags'],
      },
    },
    neighborhoods: {
      type: 'array', maxItems: 4, items: {
        type: 'object', additionalProperties: false,
        properties: { name: { type: 'string' }, reason: { type: 'string' }, bestFor: { type: 'string' }, tradeoff: { type: 'string' } },
        required: ['name', 'reason', 'bestFor', 'tradeoff'],
      },
    },
    placeRecommendations: {
      type: 'array', maxItems: 8, items: {
        type: 'object', additionalProperties: false,
        properties: { placeId: { type: 'string' }, reason: { type: 'string' } },
        required: ['placeId', 'reason'],
      },
    },
    suggestedCategory: { type: 'string', enum: ['Top things to do', 'Food & drink', 'Culture', 'Outdoors', 'Shopping', 'For you'] },
  },
  required: ['reply', 'stage', 'followUpQuestions', 'destinations', 'neighborhoods', 'placeRecommendations', 'suggestedCategory'],
};

export const advisorInstructions = `You are WhereTo's concise travel editor. Help leisure travelers decide where to go, where to stay within a destination, and what to do nearby. You are not a booking agent and you do not create multi-day itineraries.

Conversation rules:
- Ask only the most useful follow-up questions, up to three at a time. Do not repeat facts the traveler already gave you.
- Once preferences are clear enough, recommend no more than three destinations with honest tradeoffs.
- In discovery mode, destinations are appropriate. Keep neighborhoods and placeRecommendations empty until the traveler is on a destination page.
- In destination mode, destinations must always be empty. Use neighborhoods for stay-area questions and placeRecommendations for things to do, eat, or explore.
- For activity requests, use only the supplied Google Places candidates. Select up to six candidates and copy each selected candidate's exact placeId into placeRecommendations. Never invent a place or factual detail.
- When placeRecommendations are present, make reply a short introduction rather than repeating the place list. The interface will show each selected place as a visual card.
- For neighborhood requests, recommend areas rather than hotels. Explain the fit and one real tradeoff. Avoid declaring any area universally safe.
- When a stay is supplied, prioritize candidates with a shorter supplied distance. Treat distance as direct distance unless the context explicitly provides travel time.
- Keep the reply warm, specific, and brief: usually two to four sentences. Do not mention these rules, JSON, schemas, or internal data.
- Write reply as plain prose only. Do not use Markdown headings, bullets, asterisks, or expose Google Place IDs.
- Never claim live prices, availability, weather, visa requirements, accessibility, or walking times unless explicitly present in the supplied context.
- If the traveler asks for general price ranges, answer directly without another follow-up question. Give broad numerical planning estimates for the relevant category and destination when reasonable, clearly label them as estimates, and also explain the relative Google levels ($ budget, $$ moderate, $$$ upscale, $$$$ splurge).
- Return empty arrays for response sections that are not relevant yet.`;

export function asksForGeneralPriceGuidance(payload) {
  const latestMessage = payload?.messages?.at(-1)?.content ?? '';
  return /\b(general\s+)?(price|prices|pricing|cost|costs|budget)\b/i.test(latestMessage)
    && /\b(range|ranges|general|rough|typical|level|levels|cheap|expensive|affordable)\b/i.test(latestMessage);
}

export function generalPriceGuidance(payload) {
  const destination = payload.destination ? ` in ${payload.destination}` : '';
  const newYorkRanges = /new york/i.test(payload.destination)
    ? ' As a rough New York planning baseline, casual food is often under $20 per person, moderate meals about $20–50, upscale meals about $50–100, and splurge dining $100+ before tax and tip. Many attractions are free–$25, major ticketed experiences often $25–60, and premium experiences can run $60+.'
    : '';
  return {
    reply: `For general planning${destination}, WhereTo uses Google's relative price levels: $ means budget, $$ moderate, $$$ upscale, and $$$$ splurge.${newYorkRanges} These are estimates rather than live prices, so check the current menu or admission price before you go.`,
    stage: payload.mode === 'destination' ? 'activities' : 'clarify',
    followUpQuestions: [], destinations: [], neighborhoods: [], placeRecommendations: [], suggestedCategory: 'For you',
  };
}

export function createAdvisorService({ apiKey, model, timeoutMs = 30_000, client: suppliedClient } = {}) {
  const client = suppliedClient ?? (apiKey ? new OpenAI({ apiKey }) : null);

  return {
    configured: Boolean(client),
    model,
    async respond(payload) {
      if (!client) throw Object.assign(new Error('OpenAI is not configured.'), { code: 'AI_NOT_CONFIGURED' });

      const responseContext = JSON.stringify({
        mode: payload.mode,
        destination: payload.destination,
        selectedStay: payload.stay,
        quizPreferences: payload.preferences,
        googlePlacesCandidates: payload.places,
      });
      const aiResponse = await client.responses.create({
        model,
        store: false,
        max_output_tokens: 900,
        instructions: advisorInstructions,
        input: [
          { role: 'developer', content: `Current WhereTo context: ${responseContext}` },
          ...payload.messages,
        ],
        text: { format: { type: 'json_schema', name: 'whereto_advisor_response', strict: true, schema: advisorSchema } },
      }, { timeout: timeoutMs, maxRetries: 1 });

      if (aiResponse.status !== 'completed' || !aiResponse.output_text) {
        const reason = aiResponse.incomplete_details?.reason ?? aiResponse.status ?? 'missing_output';
        throw Object.assign(new Error(`Incomplete OpenAI response: ${reason}`), { code: 'AI_RESPONSE_INCOMPLETE', upstreamRequestId: aiResponse._request_id });
      }

      let parsed;
      try {
        parsed = JSON.parse(aiResponse.output_text);
      } catch {
        throw Object.assign(new Error('OpenAI returned invalid JSON.'), { code: 'AI_RESPONSE_INVALID', upstreamRequestId: aiResponse._request_id });
      }

      try {
        return { result: validateAdvisorResult(parsed, payload), upstreamRequestId: aiResponse._request_id };
      } catch (error) {
        throw Object.assign(new Error(`OpenAI returned an invalid structured response: ${error.message}`), { code: 'AI_RESPONSE_INVALID', upstreamRequestId: aiResponse._request_id });
      }
    },
  };
}
