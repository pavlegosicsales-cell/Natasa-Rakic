# Nataša Rakić — Landing Page

Conversion-focused, mobile-first landing page for Nataša Rakić, online nutrition & weight-loss coach for women (15-dnevni izazov).

## Tech
- Single `index.html` + `styles.css`
- Vanilla JS (no frameworks): live countdown, FAQ accordion, scroll-reveal, mobile nav, newsletter form, testimonial lightbox, lazy YouTube facade
- Fonts: Anton (display), Inter (body), Caveat (accent) — renders Serbian latinica (š, đ, č, ć, ž)

## Run locally
Open `index.html` in a browser, or serve the folder over HTTP:

```bash
npx serve .
```

## Deploy
Static site — deploy on GitHub Pages, Netlify, or Vercel. `index.html` is the entry point.

## TODO before launch
- Swap placeholder images/videos for real assets (`[Natašina hero fotografija]`, `[VIDEO: ...]`, `[Screenshot poruke N]`)
- Wire the newsletter `submitEmail()` to an email provider
- Set `data-yt="YOUTUBE_ID"` on video testimonials to enable lazy embeds
- Connect CTA buttons to the checkout/sign-up link
