# Demo officer accounts

> **Demo credentials only.** These are synthetic accounts on the demo deployment. Every officer currently uses the same default password. **Change it (Admin → Officers → Edit → Reset password) before any public demo or real use, and never reuse this password anywhere else.**

**Default password for every officer:** `Password123!`

**Sign in at:** https://ai-bmc-complaint-triage.vercel.app (the first request after idle can take 30–60 s while the API cold-starts).

Each officer belongs to one department and sees only that department's complaints. There are 28 officers: every department has at least one, and Roads, Water Supply, Solid Waste Management and Storm Water Drainage have three each (different wards) so the ranked officer recommendation has real choices.

| Department | Code | Email (username) | Ward | Status |
|---|---|---|---|---|
| Animal Management | `ANIMAL_MANAGEMENT` | `officer.animal_management@civicconnect.demo` | Ward D (DEMO) | Active |
| Buildings & Structural Safety | `BUILDINGS` | `officer.buildings@civicconnect.demo` | Ward F (DEMO) | Active |
| Disaster / Emergency Response | `EMERGENCY_RESPONSE` | `officer.emergency_response@civicconnect.demo` | Ward E (DEMO) | Active |
| Disaster Management | `DISASTER_MANAGEMENT` | `officer.disaster_management@civicconnect.demo` | Ward A (DEMO) | Active |
| Encroachment & Unauthorized Occupation | `ENCROACHMENT` | `officer.encroachment@civicconnect.demo` | Any | Active |
| Environmental Services | `ENVIRONMENT` | `officer.environment@civicconnect.demo` | Ward B (DEMO) | Active |
| Flood / Emergency Water Management | `FLOOD_MANAGEMENT` | `officer.flood_management@civicconnect.demo` | Ward B (DEMO) | Active |
| Gardens & Tree Management | `GARDENS` | `officer.gardens@civicconnect.demo` | Any | Active |
| General Civic Services | `GENERAL_CIVIC` | `officer.general@civicconnect.demo` | Any | Active |
| Parks & Recreation | `PARKS` | `officer.parks@civicconnect.demo` | Ward H (DEMO) | Active |
| Public Health & Sanitation | `PUBLIC_HEALTH` | `officer.sanitation@civicconnect.demo` | Any | Active |
| Public Infrastructure | `PUBLIC_INFRASTRUCTURE` | `officer.public_infrastructure@civicconnect.demo` | Ward G (DEMO) | Active |
| Public Toilets & Civic Amenities | `CIVIC_AMENITIES` | `officer.civic_amenities@civicconnect.demo` | Ward A (DEMO) | Active |
| Roads & Traffic Infrastructure | `ROADS` | `officer.roads@civicconnect.demo` | Any | Active |
| Roads & Traffic Infrastructure | `ROADS` | `officer.roads2@civicconnect.demo` | Ward H (DEMO) | Active |
| Roads & Traffic Infrastructure | `ROADS` | `officer.roads3@civicconnect.demo` | Ward C (DEMO) | Active |
| Sewerage | `SEWERAGE` | `officer.sewerage@civicconnect.demo` | Ward C (DEMO) | Active |
| Solid Waste Management | `SOLID_WASTE` | `officer.solid_waste@civicconnect.demo` | Any | Active |
| Solid Waste Management | `SOLID_WASTE` | `officer.solid_waste2@civicconnect.demo` | Ward F (DEMO) | Active |
| Solid Waste Management | `SOLID_WASTE` | `officer.solid_waste3@civicconnect.demo` | Ward A (DEMO) | Active |
| Storm Water Drainage | `DRAINAGE` | `officer.drainage@civicconnect.demo` | Any | Active |
| Storm Water Drainage | `DRAINAGE` | `officer.drainage2@civicconnect.demo` | Ward B (DEMO) | Active |
| Storm Water Drainage | `DRAINAGE` | `officer.drainage3@civicconnect.demo` | Ward E (DEMO) | Active |
| Street Lighting & Electrical Infrastructure | `ELECTRICAL` | `officer.electrical@civicconnect.demo` | Any | Active |
| Traffic Management / Signals | `TRAFFIC` | `officer.traffic@civicconnect.demo` | Any | Active |
| Water Supply | `WATER` | `officer.water@civicconnect.demo` | Any | Active |
| Water Supply | `WATER` | `officer.water2@civicconnect.demo` | Ward D (DEMO) | Active |
| Water Supply | `WATER` | `officer.water3@civicconnect.demo` | Ward G (DEMO) | Active |

## Other demo accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@civicconnect.demo` | `Password123!` |

### Demo citizens (all use `Password123!`)

| Name | Email (username) | Notes |
|---|---|---|
| Aarav Sharma | `aarav.sharma@example.demo` | 5 complaints (best for demos) |
| Priya Patel | `priya.patel@example.demo` | 1 complaint |
| Rohan Mehta | `rohan.mehta@example.demo` | no complaints yet (use to submit a new one) |
| Sneha Iyer | `sneha.iyer@example.demo` | no complaints yet (use to submit a new one) |
| Vikram Singh | `vikram.singh@example.demo` | no complaints yet (use to submit a new one) |
| Anjali Desai | `anjali.desai@example.demo` | no complaints yet (use to submit a new one) |
| Karan Joshi | `karan.joshi@example.demo` | no complaints yet (use to submit a new one) |
| Neha Kulkarni | `neha.kulkarni@example.demo` | no complaints yet (use to submit a new one) |
| Arjun Nair | `arjun.nair@example.demo` | no complaints yet (use to submit a new one) |
| Divya Rao | `divya.rao@example.demo` | no complaints yet (use to submit a new one) |
| Sanjay Verma | `sanjay.verma@example.demo` | no complaints yet (use to submit a new one) |
| Pooja Reddy | `pooja.reddy@example.demo` | no complaints yet (use to submit a new one) |
| Amit Shah | `amit.shah@example.demo` | no complaints yet (use to submit a new one) |
| Kavita Menon | `kavita.menon@example.demo` | no complaints yet (use to submit a new one) |
| Rahul Gupta | `rahul.gupta@example.demo` | no complaints yet (use to submit a new one) |
| Aniruddha Bane | `aniruddha.bane@example.demo` | no complaints yet (use to submit a new one) |

Citizens can submit, track, give feedback on and reopen their own complaints only. You can also register a new citizen account from the sign-up page.

## Changing passwords

- **Admin → Officers →** *Edit* on an officer **→ Reset password** (or the row's ⋯ menu). Enter and confirm a new password (minimum 8 characters).
- Existing passwords cannot be viewed in the app: they are stored only as one-way bcrypt hashes. This file lists the *default* that was set, so it goes out of date as soon as a password is changed.
- API: `PATCH /api/admin/officers/:id/password` with `{ "password": "..." }` (admin only).
- Existing sessions stay valid until their JWT expires.
