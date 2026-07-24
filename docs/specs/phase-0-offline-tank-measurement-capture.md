# Phase 0 — Offline Daily Tank Measurement Capture

## Problem Statement

The pilot farm has no reliable record-keeping system and operates with intermittent or absent cellular connectivity. There is currently no simple way to preserve the tank measurement collected by the milk buyer or know that the record has been backed up. A broad cattle-management system would introduce too much friction for the farm owners, who use a low-cost Android phone, often with wet hands and at milking time.

The immediate risk is not the absence of an advanced metric. It is failing to build the habit of recording one number every day. If capture depends on the network, requires per-cow data, or adds extra steps, the farm will return to loose notes and will never have dependable data for later reproductive, health, and financial phases.

## Solution

Deliver an installable, local-first PWA that lets farm owners record the daily tank measurement in under ten seconds, including while offline. The product surface contains exactly four screens: Home, Record Milk, My Cows, and Settings.

The tank measurement is the primary production fact. A person may enter liters directly or a dipstick mark when the farm's calibration table is configured; milk taken for calves is optional. The app saves the record on the device together with a durable synchronization operation, then backs it up to Supabase when connectivity returns. The interface communicates either “Guardado en el celular” or “Ya se envió” and never blocks capture on network state.

## User Stories

1. As a farm owner, I want to open the installed app without a signal, so that I can record the tank measurement anywhere on the farm.
2. As a farm owner, I want to see today's liters clearly, so that I know immediately whether today's delivery has already been recorded.
3. As a farm owner, I want to see the previous seven-day average, so that I can notice a change without reading a complex chart.
4. As a farm owner, I want one prominent “Anotar la leche de hoy” action, so that I can start the only daily task without navigating through menus.
5. As a farm owner, I want a numeric keypad for entering liters, so that I avoid errors caused by a full keyboard.
6. As a farm owner, I want to record liters directly, so that I can enter the amount declared by the milk buyer before the calibration table is available.
7. As a farm owner, I want to enter a dipstick mark when a calibration table exists, so that I do not calculate tank liters by hand.
8. As a farm owner, I want to see the mark-to-liter conversion before saving, so that I can catch an incorrectly entered mark.
9. As a farm owner, I want a clear warning when a mark is outside the calibration table, so that I can decide whether an extrapolated result is credible.
10. As a farm owner, I want to optionally record milk taken for calves, so that the internal use is not invisible without becoming a daily requirement.
11. As the administrator son, I want to use a retroactive date, so that I can accurately transcribe information reported later by the farm owners.
12. As a farm owner, I want to correct an incorrectly entered tank measurement, so that history remains useful without silently deleting the original fact.
13. As a farm owner, I want immediate save feedback, so that I know the phone preserved the record even without internet.
14. As a farm owner, I want a record to survive closing or reloading the app, so that milking-time data is not lost.
15. As a farm owner, I want to be warned about a possible same-day duplicate and choose how to proceed, so that an accidental tap does not distort the average.
16. As a farm owner, I want to confirm an unusually high or low measurement rather than be blocked, so that real farm facts are never discarded by automation.
17. As a farm owner, I want the seven-day average to include only active records from my farm, so that it is an honest reference.
18. As a farm owner, I want “Guardado en el celular” while offline, so that I can distinguish a pending backup from a failed save.
19. As the administrator, I want pending records to back up automatically when signal returns, so that nobody must re-enter data or manage files manually.
20. As the administrator, I want retried synchronization to be idempotent, so that reconnections never duplicate a tank measurement.
21. As a farm member, I want data from another farm to be inaccessible, so that family information is protected from the first release.
22. As a farm owner, I want a simple list of my cows by name and, when available, photo, so that I recognize them as the farm does.
23. As a farm owner, I want to add a cow with a name, sex, and approximate age, so that I can load the initial rejo without a technical form.
24. As a farm owner, I want only the name to be required when adding a cow, so that I can record an animal even if I do not remember every detail.
25. As the administrator, I want approximate age to remain explicitly estimated, so that an invented date is never presented as a fact.
26. As a farm owner, I want to correct cow information without physically deleting it, so that the history remains recoverable.
27. As the administrator, I want to configure basic farm details and Alpina as the buyer, so that measurements belong to the correct farm context.
28. As the administrator, I want to load and edit mark-to-liter pairs for the tank calibration table, so that the farm can use its own dipstick.
29. As the administrator, I want the calibration table to flag non-increasing liter values, so that I can correct unsafe configuration data.
30. As a farm owner, I want a one-time explanation of correct dipstick use, so that measurement quality improves without filling daily capture with instructions.
31. As the administrator, I want to install the app on the farm Android phone and open it like a regular app, so that daily use does not depend on remembering a URL.
32. As the administrator, I want every business date interpreted in America/Guayaquil, so that a dawn record never moves into the previous day.
33. As the farm team, I want this phase to exclude reproduction, health, costs, paddocks, reports, charts, and milk control, so that we validate the one-record habit first.
34. As the farm team, I want to use the app for thirty consecutive days before expanding it, so that the next phase is justified by evidence.

## Implementation Decisions

- The app is a PWA built with React, TypeScript, Tailwind, accessible components, validated forms, and persisted query state.
- Visible interface strings remain Spanish from the Carchi glossary. Code, code comments, issue titles, issue descriptions, and developer-facing documentation are in English.
- The device writes first to IndexedDB through Dexie. Supabase is a backup and collaboration service, never a prerequisite for daily capture.
- ADR-0001 applies: every mutation stores its local data and an outbox entry in one transaction. A worker sends entries when connectivity exists, uses idempotency keys, and retains a per-field last-write-wins conflict audit.
- Every business entity includes a UUIDv7 identifier, farm ID, creation and update audit data, creator, synchronization marker, and soft-delete timestamp. Corrections never perform physical deletion.
- First authentication and device provisioning require connectivity. Once provisioned, the app must continue reading and capturing data offline.
- Supabase applies farm-member access control. Phase 0 supports administrator and owner access; other roles remain modelable but are not exposed.
- Phase 0 models the farm, membership, buyer, tank calibration, animal, tank measurement, internal milk use, and synchronization outbox. It does not materialize future reproduction, health, economics, or paddock flows.
- A tank measurement keeps its local date, time, measurement moment, and reader source to remain compatible with future double readings. Phase 0 exposes only the farm's daily delivery measurement.
- Milk taken for calves is stored as an optional internal milk use on the same business date.
- The calibration table accepts mark-and-liter points. Conversion is linearly interpolated between points, returns zero below the minimum, returns no conversion for an empty table, and allows extrapolation above the maximum only with a warning.
- Home contains only today's liters, the seven-day average, and the capture entry point. It requires at least 18 px text, 48 px touch targets, high contrast, and one-handed touch operation.
- My Cows provides minimal creation and correction. Approximate age is explicitly represented as estimated; it never becomes an invented historical date.
- Settings provides farm details, buyer details, and calibration-table management. Unknown farm values remain optional; the system does not invent hectares, paddocks, health records, or asset values.
- The primary test seam is the daily capture command. It receives the tank measurement, local business date, and optional internal milk use; validates rules; persists local facts; and creates the outbox operation atomically. The UI uses it as the single save path.
- The synchronization adapter is a secondary seam. It consumes pending operations, confirms idempotent delivery, receives farm changes, and retains conflict evidence. Screens do not test Dexie or Supabase implementation details.

## Testing Decisions

- Tests verify observable behavior and domain contracts: what is saved, displayed, synchronized, and available offline. They do not depend on component internals, concrete IndexedDB queries, or visual tree details.
- Calibration conversion is tested as a pure function for exact points, interpolation, empty tables, values below the minimum, and extrapolation warnings.
- Date handling is tested around 04:00 and midnight in America/Guayaquil to prove that local business dates are correct.
- The daily capture command is tested with a fake local store to prove it writes the tank measurement, optional internal use, and outbox entry atomically; no partial write may remain after failure.
- The command is tested for duplicates, confirmed outliers, retroactive dates, corrections, and soft-deleted records.
- The synchronization adapter is tested against a fake backend for retries, idempotency, restart recovery, and farm isolation.
- Access control is tested with a member of another farm attempting to read, write, and synchronize data; every operation must be rejected.
- Interface tests cover Home-to-capture-and-back, liters mode, dipstick mode, local-save feedback, touch-target requirements, cow creation, and calibration-table forms.
- An installed-browser test verifies open, capture, close, reload, and reopen while in airplane mode. A second test restores connectivity and proves the measurement reaches backup exactly once.
- No prior test suite exists. This phase establishes the convention of testing application behavior at the daily capture command seam and validating the critical PWA journey end to end.

## Out of Scope

- Reproductive records, heats, services, pregnancy checks, calvings, dry-offs, and reproductive alerts.
- Health events, health plans, brucellosis alerts, treatments, and milk-withholding enforcement.
- Double tank readings, milk-balance calculation, production by milking, and individual milk control.
- Settlements, quality tests, fair-price calculation, revenue, expenses, cost per liter, purchases, assets, and labor.
- Paddocks, lots, rotations, stocking rate, and herd indicators.
- Charts, reports, exports, notifications, WhatsApp, RFID, and milk-meter hardware.
- Self-service multi-farm onboarding, certifications, SIFAE, and operational roles other than administrator and owner.
- Historical data import, because the farm does not have reliable historic records to migrate.

## Further Notes

- Phase approval is behavioral: the farm must record for thirty consecutive days without outside reminders. If it does not, the experience is redesigned before Phase 1 starts.
- The app may flag an unusual value but must never prevent a person from saving a confirmed real-world fact.
- Dipstick capture gives a one-time explanation that the tank must be level, foam-free, and have the agitator off. The measurement error is communicated without unnecessary technical jargon.
- Legal price settings, reproductive state, and health calculations belong to later phases. This specification does not authorize building them early.
