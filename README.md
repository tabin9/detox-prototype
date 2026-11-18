# Detox Hospitality: design prototype

A test copy of two pages in a new design, made to be tried on real phones. It is not the live website.

- `index.html`: the start page, with what to try
- `trip.html`: a trip page (the Kashmir Snow Weekend, with its real words and prices)
- `home.html`: the homepage's new moving parts

Nothing here sends anything. The enquiry form, the WhatsApp buttons and the menu do nothing, there is no tracking, and every page asks search engines not to list it.

## What is in here

- `css/system.css`: the colours, type and parts of the design system
- `js/site.js`: what every page shares (the motion switch, the slow reveal, the contact bar, the pointer's label)
- `js/route.js`: the route that draws itself on the map
- `js/home.js`: the homepage's three moving parts
- `js/trip.js`: the price levels and the two-step enquiry
- `data/route-kashmir-snow-weekend.js`: the map's shapes, built from the website's own map code

There is no build step. The pages open straight from the folder.

## Credits

- Rivers and lakes on the map: © OpenStreetMap contributors, under the Open Database Licence.
- Photographs: from Pexels, Unsplash and Pixabay, used under their licences.
- Typefaces: Fraunces, DM Sans and DM Mono, under the SIL Open Font Licence, served by Google Fonts.
- Smooth scrolling, only when a tester switches it on: Lenis, under the MIT licence, loaded from jsDelivr.
