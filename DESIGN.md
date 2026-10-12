---
name: WhereTo
description: A warm, image-led travel discovery system composed like an edited travel issue.
colors:
  warm-ivory: "#f3efe6"
  paper-deep: "#e8e0d4"
  paper-light: "#faf7f0"
  ink: "#1d1d1a"
  muted: "#6b665e"
  taupe: "#a99e8e"
  stone: "#d8d0c4"
  sage: "#667061"
  line: "rgba(29, 29, 26, 0.19)"
  line-strong: "rgba(29, 29, 26, 0.42)"
  focus-earth: "#805139"
  clear-white: "#ffffff"
typography:
  hero-display:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "clamp(4.35rem, 5.7vw, 5.4rem)"
    fontWeight: 500
    lineHeight: 0.86
    letterSpacing: "-0.04em"
  route-display:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "clamp(3.6rem, 6.2vw, 6rem)"
    fontWeight: 500
    lineHeight: 0.88
    letterSpacing: "-0.035em"
  section-headline:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "clamp(2.8rem, 4.4vw, 4.7rem)"
    fontWeight: 500
    lineHeight: 0.95
    letterSpacing: "-0.025em"
  card-title:
    fontFamily: "Cormorant Garamond, Georgia, serif"
    fontSize: "30px"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "-0.02em"
  body-large:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.65
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.2
  metadata:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  square: "0px"
  control: "2px"
  selective: "8px"
  circle: "50%"
spacing:
  xs: "8px"
  sm: "12px"
  md: "20px"
  lg: "32px"
  xl: "48px"
  section: "68px"
  section-large: "118px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper-light}"
    rounded: "{rounded.control}"
    padding: "0 22px"
    height: "48px"
  button-primary-hover:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 22px"
    height: "48px"
  search-field:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "0 4px"
    height: "84px"
  path-card:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.clear-white}"
    rounded: "{rounded.square}"
    height: "440px"
  destination-card:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
  attraction-card-selected:
    backgroundColor: "{colors.paper-deep}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
  save-control:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "44px"
  image-save-control:
    backgroundColor: "{colors.paper-light}"
    textColor: "{colors.ink}"
    rounded: "{rounded.circle}"
    size: "44px"
  map-preview:
    backgroundColor: "{colors.paper-light}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "10px"
---

# Design System: WhereTo

## Overview

**Creative North Star: "The Edited Travel Issue"**

WhereTo opens like a carefully art-directed travel magazine rather than a startup dashboard. Warm paper, charcoal type, and asymmetrical photography create calm editorial tension; a compact question and a contact-sheet hero let real places establish desire before the interface asks the traveler to choose a path.

The system stays useful beneath that atmosphere. Discovery, destination search, saved places, attraction details, the live map, and the travel editor all share the same flat paper-and-ink grammar. Cormorant Garamond carries place and emotion, DM Sans carries action and information, and hairline rules organize content without enclosing every idea in a card.

**Key Characteristics:**

- Warm ivory paper with deep ink and quiet earth neutrals.
- Self-hosted Cormorant Garamond display type paired with self-hosted DM Sans utility text.
- An asymmetrical, photography-led contact sheet in the first viewport.
- Square, borderless image fields and hairline-divided content structures.
- Photo-led path cards, destination cards, recommendations, and saved-place stories.
- Subtle page and image reveals with complete reduced-motion support.

## Colors

The palette feels like uncoated paper, charcoal ink, and muted landscape materials. Photography supplies most of the chromatic range; interface color remains deliberately quiet.

### Primary

- **Editorial Ink:** The primary voice for display type, body emphasis, active controls, strong dividers, and decisive actions.

### Secondary

- **Field Sage:** A restrained orientation color for lodging context, map information, and occasional quiet state; it is never a broad decorative wash.

### Neutral

- **Warm Ivory:** The continuous page canvas and dominant negative space.
- **Deep Paper:** A quiet selected-state layer for attraction rows and segmented choices.
- **Light Paper:** High-contrast control text, image-overlay actions, and compact floating map information.
- **Weathered Ink:** Supporting copy, location lines, captions, and secondary navigation.
- **Travel Taupe:** A low-emphasis separator and metadata accent.
- **Soft Stone:** The loading and fallback field behind photography.
- **Ink Hairlines:** Regular lines divide adjacent content; strong lines establish major table-like structures.
- **Earth Focus:** The visible keyboard focus outline and a small set of functional active-map accents.
- **Clear White:** Reserved for text over dark photographic veils and compact high-contrast states.

**The Paper Is the Canvas Rule.** Warm ivory remains visually continuous across a route; use borders, spacing, and photography before introducing another surface.

**The Photograph Owns the Color Rule.** Let destination imagery provide saturation. Interface hues stay muted and functional.

## Typography

**Display Font:** Cormorant Garamond (with Georgia and serif fallbacks), self-hosted in regular, medium, semibold, and italic regular styles.  
**Body Font:** DM Sans (with sans-serif fallback), self-hosted in regular, medium, and semibold weights.

**Character:** Cormorant Garamond gives destinations a literary, collected presence without becoming nostalgic. DM Sans keeps navigation, controls, metadata, and explanatory copy crisp enough to support browsing and task completion.

### Hierarchy

- **Hero Display** (medium, fluid 4.35–5.4rem, 0.86 line-height): The opening question; it is compact, line-broken, and allowed to feel closer to a magazine cover than an app headline.
- **Route Display** (medium, fluid 3.6–6rem, 0.88 line-height): Search, discovery, destination, detail, and saved-page titles.
- **Section Headline** (medium, fluid 2.8–4.7rem, 0.95 line-height): Major collection and editorial-story headings.
- **Card Title** (medium, 30px, 1 line-height): Destination and saved-place names; attraction titles may step down to 23–28px in denser rows.
- **Body Large** (regular, 17px, 1.65 line-height): Route introductions and longer destination or attraction prose, generally held to 50–62 characters per line.
- **Body** (regular, 12–15px, 1.55 line-height): Supporting descriptions, path guidance, and compact utility copy.
- **Label** (semibold, 11–13px): Navigation, buttons, links, filters, and save actions.
- **Metadata** (semibold, 9–10px, wide tracking, uppercase where appropriate): Coordinates, categories, ratings, status, map attribution, and field captions.

**The Two Editorial Voices Rule.** Cormorant Garamond names places and frames stories; DM Sans explains, labels, and enables action.

**The Serif Earns Its Scale Rule.** Large serif type appears only where a destination, question, or story deserves focus. Do not use it as ornamental filler.

## Layout

The application sits in a centered shell capped at 1600px with 42px desktop side padding. The home hero behaves like an editorial contact sheet: a compact question occupies the left, a dominant Tokyo image spans the center, and a narrower portrait plus intimate detail image complete an intentionally unequal three-column composition. The first-view imagery uses 12px gutters and square clipping; captions sit directly on photographs. The travel editor uses a reading-column conversation beside a compact editorial index, while destination pages pair the stay finder and AI refinement tools above the shared place list and map.

The two discovery paths form a paired, full-bleed photographic row beneath the hero. Destination browsing follows as a three-column grid with 4:5 images and generous vertical rhythm. Recommendations alternate image and story columns; saved places use an asymmetric 12-column composition. Search is presented as a typographic underline field rather than a boxed form. The destination route preserves its useful list-and-map split, while details use a 2:1 gallery and an editorial reading column beside a compact visit panel.

At 1180px, the hero becomes a two-column composition and map/detail splits collapse. At 900px, shell padding becomes 24px, destination browsing becomes two columns, and alternating stories stack. At 640px, shell padding becomes 16px, the contact sheet becomes a deliberate sequence of heading plus three photographs, path and destination grids become one column, and dense content reorganizes without removing state or navigation.

**The Contact Sheet Rule.** Asymmetry must still read as composed: one dominant photograph, clear supporting crops, shared edges, and narrow consistent gutters.

**The Story Before Inventory Rule.** Discovery surfaces lead with place, feeling, and the two traveler intents before exposing the larger destination set.

**The Mobile Continuity Rule.** Collapse the composition, not the story. Preserve the heading, all three hero images, both paths, useful state, and primary navigation.

## Elevation & Depth

The system is flat by default and uses no decorative resting shadows. Depth comes from photographic contrast, tonal paper changes, sticky behavior, and controlled overlap. Shadows are limited to functional map elements that must remain legible over roads and land: map pins, the lodging marker, and the selected-place preview.

### Shadow Vocabulary

- **Map Pin Lift** (`0 8px 22px rgba(29,29,26,.2)`): Separates interactive numbered pins from the live map.
- **Map Context Lift** (`0 8px 20px rgba(29,29,26,.16)`): Keeps the lodging marker readable over map geometry.
- **Map Preview Lift** (`0 16px 35px rgba(29,29,26,.16)`): Separates the selected-place summary from the map canvas.

**The Flat-by-Default Rule.** If a surface is readable with a hairline, tonal shift, or image edge, it does not receive a shadow.

## Shapes

The default silhouette is square. Images, content rows, search fields, path cards, maps, galleries, panels, and containers use zero-radius geometry. Buttons and compact save controls may use a restrained 2px radius; a selective 8px corner is reserved for directional map-pin geometry. True circles are limited to icon-only image save controls, small count badges, and explicit map markers.

Hairline borders and underlines do most of the structural work. The interface avoids pills, soft card stacks, and decorative organic shapes. The irregular park outline and directional map pin are functional cartographic exceptions, not a general motif.

**The Square-by-Default Rule.** Begin at 0px. Use 2px only to soften a control edge, 8px only where directional map geometry needs it, and 50% only for genuinely circular controls or markers.

## Components

### Buttons

- **Shape:** Rectilinear with a restrained 2px corner and at least a 44px target.
- **Primary:** Deep ink with light-paper text, a 48px height, 22px horizontal padding, and compact semibold labeling.
- **Hover / Focus:** Hover becomes transparent with an ink outline and a 2px upward shift. Keyboard focus uses the visible earth-colored 2px outline with a 4px offset.
- **Quiet:** Text actions use an underline or hairline edge. They do not sit inside pills.

### Cards / Containers

- **Corner Style:** Square by default (0px); controls inside may use 2px or a true circle where specified.
- **Background:** Most cards are not separate surfaces. They sit directly on warm ivory and use photography, deep paper, or ink veils only when function requires contrast.
- **Shadow Strategy:** Flat at rest; only functional map overlays use shadow.
- **Border:** Hairline top and bottom rules establish content rows and card captions.
- **Internal Padding:** Editorial rows typically use 18–34px; photographic path copy uses 36px on desktop and 22–24px on mobile.

### Inputs / Fields

- **Style:** Search is a large serif text field on the page canvas with a 2px ink underline, not a rounded container. Lodging context uses a smaller 1px underline field.
- **Focus:** The shared 2px earth outline remains visible around the containing label or action.
- **Disabled / Unavailable:** Illustrative destinations preserve the entered value, show direct explanatory copy, and reduce unavailable continuation actions to 38% opacity.

### Navigation

The wordmark combines upright and italic Cormorant Garamond. DM Sans links align opposite it in a 76px hairline-divided band. Active and hovered links use an animated underline; saved count is the only circular badge. At mobile width the band becomes 68px and spacing tightens without hiding primary destinations.

### Path Cards

The two path cards are the primary choice surface. Each uses a real destination photograph, a dark lower veil for legibility, a large serif title, concise sans-serif support, and a small square light-paper action in the upper-right. Hover gently advances the image and moves the arrow diagonally; it never rounds, lifts, glows, or gains a decorative shape.

### Destination and Story Cards

Destination cards lead with a consistent 4:5 photograph and place their title, location, and restrained metadata beneath a 1px ink rule. Saved cards vary between broad and portrait imagery inside the asymmetric collection. Recommendation stories alternate image and copy rather than repeating boxed cards. Image hover is limited to a slight scale and saturation increase.

### Attraction Cards and Map

Attraction cards are hairline-separated rows with a 190px image rail, concise metadata, a serif title, status, save action, and detail affordance. Selection uses deep paper without adding a rounded shell. The matching numbered map pin becomes earth-toned and scales up, while a compact light-paper preview appears above the illustrative map.

**The Shared Selection Rule.** Attraction rows, numbered pins, and the map preview must always describe the same selected place.

### Detail and Saved Surfaces

Attraction details lead with a square three-image gallery, then pair readable story content with a dark, square visit panel. Saved places preserve image-led browsing and immediate local save feedback. Empty states use generous whitespace between hairlines and one direct recovery action; they are waypoints, not error cards.

## Do's and Don'ts

### Do:

- **Do** let real destination photography establish mood and provide the page's strongest color.
- **Do** compose asymmetrical image groups with a clear dominant crop, aligned edges, and narrow consistent gutters.
- **Do** use Cormorant Garamond for questions, place names, and editorial story headings, and DM Sans for everything operational.
- **Do** use warm ivory as the continuous canvas and hairline rules as the primary grouping device.
- **Do** preserve the square 0px geometry, using 2px controls and true circles only for the documented exceptions.
- **Do** synchronize attraction-row, map-pin, and preview selection state.
- **Do** keep page entry and image reveals subtle, and reduce all nonessential animation to effectively zero when reduced motion is requested.
- **Do** preserve discovery, search, saved, attraction-detail, and illustrative-map flows as the visual system expands.

### Don't:

- **Don't** use gradients, glass effects, neon color, or decorative geometric flourishes.
- **Don't** turn every section into a card or every action into a pill.
- **Don't** introduce generous rounding; 8px is a selective map-geometry exception, not a general card radius.
- **Don't** add resting shadows to paths, destinations, recommendations, attraction rows, detail panels, or saved stories.
- **Don't** replace photography with abstract illustration when a place image can carry the story.
- **Don't** make filters, map metadata, or secondary facts compete with the editorial title and the route's next task.
- **Don't** turn WhereTo into a booking dashboard or remove content and state to simplify mobile layouts.
