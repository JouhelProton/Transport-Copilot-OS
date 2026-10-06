# BNB — editable transport SaaS animation

`Build-Transport-SaaS-Animation.jsx` creates a native After Effects composition from editable text, vector shapes, interface cards, and transform keyframes. It uses the product demo's order-to-service flow (`TR-10483`), dispatch dashboard, Valencia → Madrid tracking, driver POD, and billing automation.

## Requirements

- Adobe After Effects installed (no third-party plugins required).
- The script uses Arial as its safe default font. You can change fonts after the composition is built.

## Create the project

1. Open After Effects.
2. Choose **File → Scripts → Run Script File…**.
3. Select `Build-Transport-SaaS-Animation.jsx`.
4. After it builds the composition, choose **File → Save As → Save As…** and save the project as an `.aep`.

The composition is 1920 × 1080, 25 fps, and 24 seconds. Each text line and interface element is its own named layer. Scene sections are marked on the timeline. Edit copy in text layers, colors and geometry in shape layers, and timing or movement in their keyframes.

## Creative notes

- BNB is treated as the product label supplied in the request.
- The final mark is a provisional abstract concept. It does not assign a final company name, consistent with the supplied brand exploration brief.
- The transport examples and KPI values are demo data, not live tracking or real customer data.
- The script builds an editable AE composition; it does not itself render a movie. Render through After Effects when the project is ready.
