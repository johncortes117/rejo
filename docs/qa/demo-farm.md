# Demo farm

`npm run seed:demo` creates or updates an isolated Supabase scenario named **Finca La Esperanza — Demo**. It is designed for product review, not for real farm records.

The scenario contains:

- 27 active animals across milking cows, dry cows, heifers, calves, and a breeding group;
- 90 days of daily tank measurements plus buyer pickup records;
- current reproduction and health examples, including heat, presumed pregnancy, repeat breeder, near calving, milk withholding, and pending preventive tasks;
- paddocks, grazing lots, rotation history, milk control sessions, settlements, quality tests, cash movements, assets, and family labor.

The seed uses stable IDs and upserts, so running it again refreshes the same data without creating duplicates. It preserves the existing scenario date automatically; set `REJO_DEMO_DATE` to deliberately start the scenario on another business date.

## Credentials

The first run prints the demo email and generated password. Store that password outside the repository. To refresh an existing demo account, set `REJO_DEMO_PASSWORD` before running the command:

```powershell
$env:REJO_DEMO_PASSWORD = "the-existing-demo-password"
npm.cmd run seed:demo
```

The application resolves a signed-in user's existing `farm_members` record before offering farm provisioning. This lets the demo account open its populated farm directly on a new phone or browser.
