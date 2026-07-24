# Mobile information architecture for field operations

## Status

Accepted

## Context

REJO is used on a phone while farm work is underway. Earlier screens combined a dashboard, a history, a registration form, and permanent configuration in the same scroll. That made routine work harder to recognize and made the most important action compete with infrequent setup.

The application must remain local-first. Reorganizing a screen cannot make a field record depend on connectivity, change the economic calculations, or alter the meaning of the farm domain terms.

## Decision

The mobile application is organized by work intent rather than by database entity.

- The persistent bottom navigation has four destinations: Home, Rejo, Finance, and More.
- Home is the daily entry point. It prioritizes the tank measurement, a small number of alerts, and a limited set of frequent shortcuts.
- Rejo is the hub for animals, reproduction, health, and milk control. An animal's full-screen record remains the place for individual history and individual registration.
- Finance has separate Summary, Settlements, Movements, and Costs sections. Registration workflows open only from an explicit call to action and in a focused full-screen surface.
- More contains infrequent destinations such as paddocks and farm configuration. Paddocks remains available from Home as a frequent shortcut because its daily location check is distinct from its stable navigation location.
- Paddocks opens with the current location of the rejo and a concise rest summary. Moving a lot, creating a paddock, and creating a lot are focused workflows.
- Farm configuration contains permanent data only. Operational health tasks remain in Rejo > Health.

Every summary is allowed to link to detail, but it must not mount unrelated forms by default. Icons support clear labels; they never replace them. Interactive controls must remain touch-sized, keyboard-focusable, and usable on narrow screens.

## Consequences

Users see one dominant intent at a time: review the current state, open a history, register a fact, or configure the farm. The application has more explicit navigation surfaces, but each surface carries less unrelated information.

Existing local mutations and outbox operations are retained. New entry surfaces call the same domain commands as their previous inline forms, so they continue to save locally and queue synchronization when offline.

Future modules must choose a stable destination and a dominant first-screen intent before adding controls. A new form should not be added to a summary screen merely because it uses the same data area.
