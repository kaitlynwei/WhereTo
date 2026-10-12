# AI itinerary maker

The first focused version is now implemented in **My Trip**. A signed-in user saves real Google places, chooses one to seven days and a pace, and asks WhereTo to arrange those places into daily groups. The result is saved directly on the current Trip and survives refresh and future sign-ins.

## Current MVP

- uses only Google Place IDs already saved to the user's Trip
- considers destination, stay, coordinates, preferences, dates, and available opening information
- supports relaxed, balanced, and full-day pacing
- saves the generated plan at `users/{uid}/trips/current.itinerary`
- removes an unsaved place from the existing itinerary automatically
- validates and limits all itinerary input on the server
- rejects invented Place IDs and adds back any verified saved place omitted by the model
- allows the user to regenerate or clear the plan

The AI makes a useful first draft, not a booking or live logistics promise. Users are reminded to confirm hours and reservations.

## User inputs

- destination and dates
- one day or multiple days
- home base/stay location
- start and end times
- interests, budget, pace, accessibility needs, and dietary preferences
- must-do saved places and places to avoid
- preferred itinerary style

## Itinerary styles

- **Classic Highlights** — major landmarks with realistic time between them
- **Food and Neighborhoods** — markets, local restaurants, and walkable area clusters
- **Relaxed Day** — fewer stops, longer breaks, and flexible timing
- **Hidden Corners** — smaller verified places outside the most obvious highlights

Comparing styles, replacing individual stops, and detailed time slots remain future improvements.

## Verified-place pipeline

1. Search Google Places for a bounded candidate set based on the destination, user interests, saved places, and stay location.
2. Store stable Google Place IDs and the fields needed for planning.
3. Exclude closed, duplicate, or geographically unrealistic candidates before calling AI.
4. Give the AI only those candidates and require a structured response containing their exact Place IDs.
5. Drop any output Place ID that is not in the candidate set and replace an empty result with verified candidates.
6. Fetch or refresh current place details after AI selection.
7. Validate opening hours and travel gaps. If a stop fails validation, replace it from the verified candidate set or show a clear warning.

AI chooses the order and explains the tradeoffs; Google data remains the source of truth for place identity, coordinates, and available opening information.

## Travel-time validation

For a first version, cluster places by coordinates and use conservative travel buffers. A later version can optionally enable Google Routes API to calculate walking, transit, or driving times between the stay and each stop. Routes should be called only for the short list, not every search candidate, to control cost.

## Firestore structure in use

```text
users/{uid}/trips/current
  destinations
  dates
  stay
  preferences
  savedPlaces (subcollection)
  itinerary:
    version
    title
    summary
    pace
    dayCount
    generatedAt
    days: [{ day, title, note, stops: [{ placeId, timeOfDay, reason }] }]
```

Firestore rules should use the same `{uid}` ownership pattern as profiles, saved places, and stays, with strict field and size validation.

## Possible later phases

1. **Individual editing:** replace or move one stop without regenerating everything.
2. **Stronger timing checks:** date-specific hours, estimated visit duration, and meal timing.
3. **Routes integration:** travel time between the short-listed stops rather than only geographic grouping.
4. **Multiple styles:** compare highlights, food-focused, relaxed, and hidden-corners plans.

## Student-friendly summary

The itinerary maker works like a smart organizer, not a source of random places. The user first saves places they actually care about. The AI then arranges only those verified places into a simple one-to-seven-day plan based on the trip, stay, and preferred pace. Later versions can add stronger hours and travel-time checks without changing this foundation.
