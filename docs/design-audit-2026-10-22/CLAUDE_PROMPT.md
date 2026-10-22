# Prompt for Claude

Improve the design and usability of the existing Ikie Barber website in `/Users/nurhanfawwaz/Desktop/dev/aqil`. Implement a focused polish pass across the public booking flow and owner workspace. Start by reading `docs/design-audit-2026-10-22/AUDIT.md` and inspecting its screenshots. Recheck current source and rendered state because another session may have changed the project since the audit.

## Skills to use

Load these existing skills in this order; read the files directly if slash invocation is unavailable:

1. `frontend-design-direction` — `/Users/nurhanfawwaz/.claude/skills/frontend-design-direction/SKILL.md`. Define a specific direction for a local barber and a compact daily owner tool.
2. `design-system` — `/Users/nurhanfawwaz/.claude/skills/design-system/SKILL.md`. Audit existing tokens and consolidate spacing, type, surfaces and interactive states. Preserve the established identity.
3. `make-interfaces-feel-better` — `/Users/nurhanfawwaz/.claude/skills/make-interfaces-feel-better/SKILL.md`. Refine alignment, text wrapping, touch targets, selected states and number alignment.
4. `frontend-a11y` — `/Users/nurhanfawwaz/.claude/skills/frontend-a11y/SKILL.md`. Handle connected field errors, keyboard navigation, focus changes, contrast and reduced motion.
5. `browser-qa` — `/Users/nurhanfawwaz/.claude/skills/browser-qa/SKILL.md`. Verify the finished pages in a browser across mobile, tablet and desktop with screenshots and real interaction checks using isolated test data.

These skills are installed locally. Apply the relevant parts to this task. Supabase/database work is not needed for this design pass; retain existing access controls and booking validation.

## Design direction

Keep the recognizable logo, Oswald headings, monochrome palette and direct local-barber tone. Make the site feel intentional, compact and easy to book. Preserve visual character while improving practical information and spacing. Public pages can be expressive; admin pages should prioritize quick scanning and repeated daily tasks. Avoid stock imagery, invented reviews, gradients, excessive animation, unnecessary nested cards and new UI dependencies. Use existing assets and components.

## Implementation priorities

1. **Fix availability messaging.** When the shop is in away mode, remove instructions to pick a nonexistent slot. Use an unavailable summary and the existing WhatsApp contact action. Keep “closed right now, future bookings allowed” distinct from “booking disabled”. Cover no phone number, no available times, selected slot, pending and success states.

2. **Fix desktop admin sidebar overflow.** In `app/admin/(dashboard)/layout.tsx`, the logo/name and language switch exceed the 256px sidebar. Stack or relocate controls at desktop widths while keeping a clean mobile row. At 1440px the language switch currently extends to approximately x=302. Check 1024px too, long shop names, and BM text. Do not mask overflow with clipping.

3. **Improve the public hierarchy.** In `app/page.tsx`, shorten the hero and add concise translated service information: shop visits and house calls in Putrajaya, Cyberjaya and Bangi. A blank configurable description must not leave the slogan as the only explanation. Show a compact price summary before users commit to a slot or enter details, using the existing `PRICES` values. Keep the full price list easy to reach. On desktop use a balanced two-column composition for booking and supporting information; on phones make it a logical single column. Preserve the exact-address disclosure behavior.

4. **Make booking progression clear.** In `components/customer-timetable.tsx`, distinguish choosing a date/time from entering details using concise section labels and a clear selected summary. Keep a usable date input, 30-day range and all valid slots. Consider compact day shortcuts only if they reuse existing date logic. Make available, selected and taken slots clearly different. After selection, orient users toward the details form without surprising keyboard users. The mobile sticky bar must show the selected date/time plus the primary action, allow changing the selection, and avoid obscuring content or focused fields. Account for safe areas and the mobile keyboard. Keep current duplicate-slot handling and retry behavior intact.

5. **Correct confirmation content.** The action currently returns the shop address for both shop visits and house calls, and the UI always says “Where to find me”. Render a location-specific confirmation: directions for shop visits, a house-call visit summary for house calls. Never send a house-call customer to the shop. Keep “You’re booked” consistent with the saved database state; explain WhatsApp as sharing/contact if saving already reserves the slot. Do not invent a second approval workflow. Move focus to the confirmation heading and announce success.

6. **Improve the owner dashboard hierarchy.** Put upcoming appointments near the top of `app/admin/(dashboard)/page.tsx`. Keep today's earnings prominent and make week/month totals more compact. Reduce space consumed by empty states while preserving clear Add earnings access. Keep Hours, History and Settings consistent with the same spacing/type system. Make zero-data history understandable. Resolve the Settings image-URL control that currently has no visible effect, while preserving `/logo.png` as a fallback.

7. **Polish accessible interaction states.** Connect booking validation errors to fields with stable IDs, `aria-describedby` and `aria-invalid`; use explicit label associations where they improve clarity. Keep native labels, visible focus, at least 44px primary touch targets, and reduced-motion handling. Check active navigation for nested history routes. Use tabular numerals for money and times. Maintain readable dark-mode surfaces and sufficient text contrast. Add new English/Malay strings through the existing translation system.

## Scope and constraints

Use the existing Next.js App Router, TypeScript, Tailwind, lucide-react and components. Read applicable repository instructions first. Preserve booking rules, prices, extra-charge amounts, house-call areas, timezone logic, authentication, RLS, manual earnings and realtime behavior. Do not add payments, customer accounts, service-duration rules, overnight bookings or backend migrations as part of this task. Do not reinterpret “Base price” or automatically calculate surcharges without a defined business rule. Do not change the owner's stored away note or settings to make the screenshots prettier.

The server on port 3000 may point to real shop data. Use the repository's test fixture and test credentials for owner/booking interactions. Prefer an isolated source copy and separate Next build directory if another dev server is running, to avoid corrupting its build cache. Do not write to the real database or send WhatsApp/Instagram messages.

## Acceptance checks and deliverables

- At 375×812, the initial available state explains the service and exposes a useful start to booking; pricing is easy to find before entering customer details.
- Check 320, 375, 768, 1024 and 1440px for overflow, wrapping and fixed-bar collisions. Sidebar controls remain fully inside the sidebar.
- Verify English and Malay, light and dark themes, keyboard operation and reduced motion. Include 200% zoom/reflow and mobile-keyboard behavior where tooling supports it; disclose any untested case.
- Exercise away mode, closed-now/future-open, no slots, booked slots, selected slot, shop/house-call details, validation, pending, duplicate-slot conflict and success against isolated fixtures. Preserve idempotent retry behavior.
- Check owner Home, Hours, History, Settings, login and earnings dialogs. Use screenshots to compare before and after. Run an accessibility scan if tooling is available, plus manual keyboard/focus checks; do not equate a clean scan with full accessibility.
- Run `npm run typecheck`, `npm test`, `npm run test:e2e`, and `npm run build` in an isolated environment where needed. Add targeted regression coverage for changed state behavior, especially away-mode messaging, house-call confirmation and sidebar containment. Do not write tests that only duplicate CSS implementation.
- Deliver implemented changes, desktop/mobile before-and-after screenshots, a short explanation of design decisions, and exact check results with any remaining limitations. Complete the implementation rather than stopping after a plan.
