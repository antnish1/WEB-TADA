# WEB-TADA

Professional TA/DA and engineer deputation workflow for Frontier Commercial Vehicles.

## Current foundation

This branch contains the first working **Today's Deputation Entry Module**.

### Included

- Branch-wise roster loading for all 67 supplied engineers
- Mandatory daily status for every engineer
- Onsite, Workshop, Leave, Absent, Weekly Off, Training, Meeting, Free and Other statuses
- Multiple calls per engineer
- Planned start and expected completion times
- Overlap warnings for multiple calls
- Search and pending-only filters
- Automatic local draft saving by branch and date
- Finalization validation so no engineer is missed
- Responsive desktop and mobile layout

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Current data behaviour

This foundation stores draft and finalized snapshots in browser `localStorage`. The next phase will replace that with Supabase authentication, branch-level permissions, permanent database storage, machine/customer lookup, audit history and engineer notifications.

## Development branch

`feature/deputation-entry-foundation`
