# WCAG 2.2 AA verification checklist

Automated axe checks run in Playwright, but they do not replace this manual pass. Complete it on the release preview at desktop and a 390px mobile viewport.

- Navigate every public, overseer, and publisher workflow using keyboard only. Confirm the skip link, visible focus, logical order, modal focus trap/return, and no keyboard traps.
- Check VoiceOver with Safari: landmarks, headings, form labels, validation errors, status badges, map alternatives, dialog titles, live sync updates, and visit confirmations.
- Verify all controls have at least a 44px target in default mode and remain usable in Big Mode.
- Enable dark, high-contrast, Big Mode, and reduced motion separately and together. Confirm content does not overlap or disappear at 200% zoom.
- Confirm every territory, house, sync, and DNC state has text or an icon in addition to color.
- Check error, empty, loading, offline, queued, conflict, expired-link, and update-available states.
- Deny microphone and geolocation permissions and confirm manual note entry and list navigation remain available.
- Confirm DNC haptic alerts have a visible/text announcement and can be disabled.
- Verify map workflows have adjacent list/form equivalents and drawing instructions do not rely on pointer input alone.
- Run axe on landing, login, invite, dashboard, territory detail, members, reports, field list/map, return visits, settings, offline, and checkout.

Record tester, date, browser/assistive technology versions, failures, and remediation link in the release review.
