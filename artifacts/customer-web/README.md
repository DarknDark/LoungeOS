# LoungeOS Customer Application Boundary

This directory is reserved for the responsive QR customer web application.
It must remain a separate product surface from the authenticated Expo staff
application.

Customer routes may consume shared domain, API contract, and presentation
libraries, but must not import staff navigation, staff dashboards, inventory
management, settings administration, or developer tools.

The customer application is intentionally not implemented in Module 1.