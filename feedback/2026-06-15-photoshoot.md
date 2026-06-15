# Photoshoot Review Feedback

## Photoshoot grid (/photoshoot)

![photoshoot grid](image.png)

- Replace '// step 2' with '// step 1'.
- Let's use the same promptComposer as in /campaigns to allow the user to select a product and reference images for the photoshoot. They'll include a prompt with what they want for the photoshoot and we will use the LLM to improve the photoshoot prompt and the selected styles. We can definitely improve which option for photoshoot style we offer.
- Update the grid to let at most 4 columns.
- In the photoshoot grid card let's fill the cover images with as many images from each shot as possible. For example, if a photoshoot only has 1 shot, but multiple 4 variants, it should display all 4 images from that single shoot. If it has 4 shoots, each with 3 variants, then pick one image from each shoot.


## New Photoshoot (/photoshoot/new)

![photoshoot new](<image copy.png>)

- Let's improve the UI/UX for this whole page.
- This should be prefilled with the selected product and reference images selected by the user (not editable at this point, just displayed) and the LLM results (photoshoot prompt + preselected styles).
- User should be able to name the photoshoot to whatever name they want (not linked to the product name at all).
- User should be able to edit the prompt if they want to.
- Let's include 16:9 aspect ratio in the options.
- Buzz cost estimates should happen at this step since we have all the info to calculate estimates.

![photoshoot new review](<image copy 3.png>)

- In the review step, let's allow the user to edit the prompt in place, instead of having them to click the edit raw prompt.
- I'm seeing the we have selected three styles, but only two different show as // studio and // lifestyle · in use, there should be one for each style.
- Improve the prompts for each selected style to get better and more consistent results.
- Make sure that we are sending the reference images and product images when sending the request to the orchestrator.

## Photoshoot details page (/photoshoot/[id])

![photoshoot details](<image copy 4.png>)

- Let's improve the layout to look similar to the campaigns details page. One row for each style with a horizontal list to display each variant.
- Let's remove the 'linkedin · 1:1' badge.
- Look a better place to include the 'use as product image' and 'use in campaign' options with the new layout. Can be CTA buttons.
- Remove the text between the breadcrumb and the title.
