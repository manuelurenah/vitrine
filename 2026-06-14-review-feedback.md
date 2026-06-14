# Review Feedback 2026-06-14

## Brand DNA Overview (/brand)

- Add the ability to rescrape the brand url.
- After brand URL is set, it should not be editable (prevents rebranding).
- Tagline and description can live on the same card.
- Include labels for each input field in the identity card.
- Save changes button should remain disabled until form is dirty.
- Include loading state for the save button when request is in flight.

## Catalog (/brand/catalog -> /catalog)

- Re-route from '/brand/catalog' to '/catalog'.
- In the context menu for each card, include related icon for the menu options.
- Remove the '+ add another product' at the end of the product grid/list. There should only one main CTA at the top.
- The product card should be fully clickable and link the user to the product details page.

### New Product (/brand/catalog/new -> /catalog/new)

- Re-route from '/brand/catalog/new' to '/catalog/new'.
- Include a back button.
- Replace 'brand DNA · new' eyebrow to just '// catalog'.

### Product Details (/brand/catalog/[id] -> /catalog/[id])

- Re-route from '/brand/catalog/[id]' to '/catalog/[id]'.
- Place the main CTAs at the top right, in the same row as the back button. The context menu button can be placed together the CTAs.
- The 'use in campaign' should be primary CTA and 'use in photoshoot' is secondary CTA. Style properly and include icons inside the button.
- Place the live badge right above the product title, replace the '// product' eyebrow since it's redundant.
- Improve contrast of the actions inside the product image.
- The add and upload actions in the carousel do the same thing, let's just keep the upload action.
- Make border radius for actions consistent across the board.
- Instead of having a dedicated edit page for the product, let's have the edit on the same details page. The right panel just become editable inputs.

### Product edit (/brand/catalog/[id]/edit)

- Remove entirely

## Assets (/brand/assets -> /assets)

- Re-route from '/brand/assets' to '/assets'.
- Assets only houses uploaded and generated images. Images from campaign/photoshoot generations have their dedicated pages.
- Move upload and generate CTAs to the same row as the title (similar to CTA in /catalog). Upload is the primary, while Generate is secondary.
- Include sorting dropdown next to grid/list toggle view (Similar to /catalog).

### Ad-hoc generation

- Make the prompt input auto focus on modal open
- For accordion items (negative prompt and reference images) let's remove the + sign. The chevron indicator should be enough.
- When opening add reference image, it should only allow selecting other asset images, not products.
- Let's skip the entire select generation step after user clicks the generate button. Instead, let's do something similar as with campaigns and photoshoot items, where we display placeholder cards in the /assets grid with cooking indicator and live polling to the orchestrator. All ad-hoc generated images should be saved as assets.

### New Asset (/brand/assets/new -> /assets/new)

- Re-route from '/brand/catalog' to '/catalog'.
- Include a back button.
- Replace 'brand DNA · upload' to just '// upload'.
- Remove the upload/pick from library options.
- Accepted file types only sbg, png, jpg.
- Change add to library button icon to be a save icon.
