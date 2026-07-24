# Mobile UX validation checklist

Use this checklist on the deployed Android PWA before closing the mobile information architecture work.

## Device and layout

- Open the app at 360 px and 412 px wide viewport sizes.
- Confirm that no content causes horizontal scrolling.
- Confirm that the bottom navigation stays visible above Android system navigation and has four destinations only: Home, Rejo, Finance, and More.
- Confirm that every icon-only control has an accessible label and every action can be understood from its visible label.
- Turn on a large system font size and confirm that primary actions, field values, and status badges remain readable.
- Navigate with a hardware keyboard, if available, and confirm that focus is visible on buttons, inputs, selects, and summaries.
- Turn on reduced motion and confirm that the app remains usable without transition-dependent feedback.

## Daily farm operations

- From Home, record a daily tank measurement while offline and confirm the saved value appears when returning to Home.
- Add an internal milk use for calves and verify that the value remains visible in the milk and finance context.
- Open Rejo, add an animal through the step-by-step flow, and verify its group assignment.
- Open the animal record, add a health event with milk withholding, and verify that the animal appears in the Health worklist.
- Open Reproduction and verify that a relevant animal opens directly in the reproduction section of its record.
- Open Paddocks, create a paddock and a lot, move the lot, and verify that the overview shows the current location before the detailed list.

## Finance operations

- Open Finance and verify that Summary appears before any entry form.
- Open Settlements and register a settlement. Verify that the history and calculated fair price appear after saving.
- Open Movements and register both an expense and an income. Verify that their sign, category, and amount are visible in the list.
- Open Costs and add an asset and family labor. Verify that the relevant cost-per-liter value updates when production readings exist.

## Offline and synchronization behavior

- Put the phone in airplane mode before each primary registration flow.
- Confirm that each successful record says it was saved on the phone and that the header shows pending backup when applicable.
- Reconnect the phone, use Backup, and confirm that the pending indicator clears without losing local records.
- Reload the installed PWA before reconnecting and confirm that all locally recorded data remains available.

## Empty, error, and return states

- Check a new farm with no animals, paddocks, movements, or settlements; each page must explain the next useful action.
- Enter invalid values in each dedicated entry screen and verify that the error is specific and the entered data is not silently discarded.
- Close a dedicated entry screen without saving and verify that the user returns to the same overview or section.
- Use each back control from Paddocks and Milk Control and verify that it returns to the page from which it was opened.
