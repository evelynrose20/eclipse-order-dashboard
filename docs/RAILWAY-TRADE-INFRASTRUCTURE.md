# Internal Rail Logistics — menu-based Order transport

## Current system (migration 049)

The dedicated railway station icons, track-switch controls, crossings, and separate **Lay track** tool have been retired from the map. **Existing railway lines remain visible on the territory map**, with their original railway styling. The regular **Plan a route / Edit routes** tools retain a **Railway (map only)** route type for drawing and shaping decorative rail lines. No drawn map geometry is required for internal train services. Existing map railway tables (migrations 045–048) and previously saved tracks/facilities remain in MySQL; route geometry remains visible on the map; this rollout does **not** delete or migrate them into new services.

In the dashboard sidebar, open **Industry & Logistics → Internal Rail Logistics** (train icon), alongside **Trade Routes**. This is a **command-only** workspace available to Domina and High Command, not the public trade-contract system. The map's road, trail, railway, waterway and skyway lines, settlements, and mountains remain available.

### Stations tab

Create a named internal railway station at an **Order-controlled settlement** or an **active Order-owned front** (not a personal front). Set its operating status (Planned, Operational, Closed, Damaged), platform count (1–100), and descriptive notes. Stations are ordinary directory records and never appear as map markers. They have no rails, crossing signals, or geometry to edit. A station used by a service cannot be deleted until the services are dealt with.

### Rail Services tab

Create services between two stations at **distinct locations**, whether inside one zone, different zones or separate regions. Choose the two stations, a service name, configurable travel duration (1 minute–7 days), status (Active, Paused, Retired), and cargo/RP notes. Cross-zone or cross-region trains require no map joins or coordinate-based links.

Dispatch a train from an Active route only when both stations are Operational and both locations remain Order-controlled/Order-owned. One train at a time may run on each service. The server stores departure and expected-arrival timestamps in UTC; the UI shows a live horizontal progress bar with a **Font Awesome train icon** and estimated time remaining. Trains become Arrived when their scheduled time has elapsed; completed and cancelled journeys remain in history. Cancel a running journey, pause or retire a service, and edit route duration from the menu.

This phase is **operational scheduling and RP tracking only**: it does not automatically transfer, withdraw, reserve or duplicate materials, fuel or player/front stock. Descriptive cargo notes are not a material manifest. Inventory-safe shipment workflows can be added later after agreement on source accounts, reserved resources, delivery confirmations, and idempotent stock transfers.

### Data retention / migration

Migration `049_internal_rail_logistics.sql` creates additive tables for stations, services and train journeys. Migration `050_internal_rail_damaged.sql` adds the **Damaged** station status safely to existing installations. It does not remove legacy railway schema or old saved tracks. Run `npm run setup:local` after a database backup and pulling the latest `main` on the Windows host, then restart the Windows API service. All previously applied migrations (including 045–048) remain in place.

### Acceptance checklist

- Two Order-controlled settlements or an Order-owned front are available in the station location dropdown.
- Create a station at each location, set both to Operational.
- Create a service joining them, including across different zone or region boundaries.
- Dispatch; verify that the train badge advances and ETA updates.
- Attempt a second dispatch before arrival; it should be refused.
- Cancel the train or allow its ETA to pass; verify journey history persists across reload/restart.
- Confirm that the territory map still shows railway lines and permits **Railway (map only)** editing through the normal route editor, while station badges, the Lay track tab, switches and crossings editor are absent.
- Confirm old tracks and facility data were not deleted from MySQL and unrelated roads remain editable.
