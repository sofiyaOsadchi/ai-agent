# FAQ Builder Current HTML/CSS Package

Created: 2026-06-06

This folder contains a point-in-time copy of the current FAQ Builder frontend for UX review.

Files:

- `faq-playground.current.html` - full current builder HTML. It also contains the main desktop CSS inside the `<style>` block near the top of the file and the builder JavaScript near the bottom.
- `mobile-responsive.current.css` - current external responsive CSS loaded by the builder for narrow screens through `/mobile-responsive.css`.

Notes for UX review:

- The current builder page source is `public/faq-playground.html`.
- The main builder CSS is not a separate desktop CSS file; it is embedded in `faq-playground.html`.
- Additional guided-setup scripts are intentionally not included here, because this package is only for the manual builder page review.
- Assets such as the logo and favicon still resolve from the existing `public/` directory when the original app is served locally.
