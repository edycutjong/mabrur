# Lighthouse summary

Lighthouse 12.8.2, run on 10 Okt 2026 (~07:25 WIB) against a local production build (`next build && next start`, port 3101) of the app.
Default Lighthouse mobile (simulated throttling) and desktop presets. One run per route and preset.

```
/app           mobile  perf  72 a11y 100 bp 100 seo 100 LCP   4.3s CLS 0.000 TBT  538ms FCP 1.1s
/app           desktop perf  99 a11y 100 bp 100 seo 100 LCP   0.9s CLS 0.000 TBT    3ms FCP 0.3s
/app/jamaah    mobile  perf  70 a11y 100 bp 100 seo 100 LCP   4.4s CLS 0.008 TBT  583ms FCP 1.1s
/app/jamaah    desktop perf  99 a11y 100 bp 100 seo 100 LCP   0.8s CLS 0.003 TBT    3ms FCP 0.3s
/app/agen      mobile  perf  71 a11y 100 bp 100 seo 100 LCP   4.5s CLS 0.000 TBT  515ms FCP 1.2s
/app/agen      desktop perf  99 a11y 100 bp 100 seo 100 LCP   0.9s CLS 0.007 TBT    3ms FCP 0.3s
/judge         mobile  perf  74 a11y 100 bp 100 seo 100 LCP   4.4s CLS 0.000 TBT  446ms FCP 1.2s
/judge         desktop perf  99 a11y 100 bp 100 seo 100 LCP   0.9s CLS 0.000 TBT    2ms FCP 0.3s
/              mobile  perf  99 a11y 100 bp 100 seo 100 LCP   2.0s CLS 0.000 TBT    0ms FCP 0.8s
/              desktop perf 100 a11y 100 bp 100 seo 100 LCP   0.5s CLS 0.000 TBT    0ms FCP 0.2s
/pitch         mobile  perf  95 a11y 100 bp 100 seo 100 LCP   2.9s CLS 0.000 TBT    0ms FCP 1.2s
/pitch         desktop perf 100 a11y 100 bp 100 seo 100 LCP   0.6s CLS 0.000 TBT    0ms FCP 0.3s
/app/vendor    mobile  perf  70 a11y 100 bp 100 seo 100 LCP   4.4s CLS 0.006
/app/vendor    desktop perf  99 a11y 100 bp 100 seo 100 LCP   0.9s CLS 0.000
```

Reading it: the landing page (`/`) scores 99 on mobile and 100 on desktop; the pitch deck (`/pitch`) 95 on mobile and 100 on desktop.
Accessibility, best practices and SEO are 100 on every route.
Mobile performance on `/app/*` and `/judge` is 70–74: Lighthouse's simulation counts about 1.5 MB of wallet-SDK JavaScript (wagmi, RainbowKit, WalletConnect) on those routes.
