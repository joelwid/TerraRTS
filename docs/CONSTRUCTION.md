# Milestone 2 construction and territory

The colony starts with a free, completed Hub and the eight starting stocks from [Economy](ECONOMY.md). The build menu offers the Hub, Geo Scanner, and Terraformer. Their footprints, costs, durations, radii, and demolition refunds are defined in `src/data/buildings.json` and validated at startup.

## Construction

Choose a building and hover a tile to preview the whole footprint anchored at that tile. Green means the footprint is buildable, unoccupied, fully claimed, and affordable. Red shows which requirement failed. Clicking a valid preview pays the entire cost, reserves the footprint immediately, and selects the new site. Sites advance independently on the 10 Hz simulation clock.

Select a site to see its progress or cancel it for a full refund. A finished expansion Hub refunds half the original cost, rounded down per resource. Finished Scanners and Terraformers refund zero. Removing a building releases its footprint. The original Hub is protected from cancellation and demolition.

## Territory and permanent effects

A completed Hub claims and scans tiles whose centers are within its Euclidean radius. Territory grows from the original Hub. An expansion Hub contributes its radius only when its full footprint is covered by territory already connected to the original Hub. Rebuilding a missing link can reactivate disconnected buildings. Coverage from surviving connected Hubs persists after demolition.

A Geo Scanner surveys every tile within its radius once at completion, including unclaimed tiles. A Terraformer fertilizes claimed, buildable soil within its radius once at completion. Both effects require the building's footprint to be claimed at completion. A disconnected site finishes inactive. Reconnection restores its active status after the one-time effect's completion window has passed. When a Hub and a one-time effect finish on the same tick, territory is resolved first.

Past survey and fertility remain after demolition or loss of claim. Selecting a tile distinguishes unscanned land from surveyed empty ground and known deposits. The terrain draws resource cracks only on surveyed tiles. A headless simulation owns placement, inventory, occupancy, and tick progression. The browser uses the same validator for previews and commands and reads view snapshots for rendering.

Resource production and deposit-specific construction rules begin in Milestone 3. This prototype uses the existing costs and starting stock.

## Verification

- `npm ci`, `npm run typecheck`, `npm test` (30 tests), and `npm run build` passed. Vite reported a size warning for the Phaser-containing bundle (about 340 kB gzipped).
- The production preview passed a headless Chromium 156 smoke test. Verified construction previews, upfront stock deduction, cancellation, completion, demolition refunds, survey visibility, fertility persistence after claim loss, overlapping claims, and the existing camera and selection controls. The browser reported zero console or page errors.
