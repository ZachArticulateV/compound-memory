# UI prototype

Structurally different versions of one screen, switchable in the browser, so
the user can compare them in place and pick one or combine parts of each.

## Where the variants live

- **Inside the existing page (preferred).** Render the variants on the real
  route, behind a `?variant=` URL parameter, under the real header, data, and
  density. Only the rendered subtree changes; data fetching and auth stay.
  Something that would live inside an existing page (a new card, a new step)
  still goes there.
- **A new throwaway route**, only when nothing existing could host it. Follow
  the project's routing convention and put `prototype` in the path.
- **No code router** (Wix Studio, WordPress, a static site): build standalone
  HTML mockups that load the site's real stylesheet and fonts, with the same
  switcher. Compare them in the site's real context with a screenshot of the
  surrounding page when the live page cannot be edited.

## Steps

1. **Write the plan in one line** where the prototype lives: "Two variants of
   the signup form on `/signup`, switchable with `?variant=`."
2. **Make two variants** (up to five when asked). Each one changes the layout,
   the information hierarchy, or the primary action, not just colors or copy.
   Variants may share small pieces such as a header, but each owns its own
   layout; a shared layout component makes them the same screen. If two come
   out similar, redo one with an explicit constraint ("no card grid"). Use the
   project's own component library and styles. When the question is wide open
   ("make onboarding more fun"), first name three to five different mechanisms
   in a line each and let the user pick which to build; two close variants are
   for a narrow question.
3. **Wire one switcher:** read the parameter, render `VariantA` or `VariantB`,
   and mount a small fixed bar at the bottom center with previous and next
   arrows and the variant's name. Arrow keys cycle too, except while an input
   has focus. The bar updates the URL so a variant is shareable, looks
   different from the design under test, and is hidden in production builds.
4. **Hand over the URL** and the variant keys. The useful answer is often "the
   header from A with the list from B": that combination is the design.
5. **Capture** which variant won and why, fold the winner into the real page
   (rewritten to production standard, with tests), and move the rest and the
   switcher to the prototype branch.

Variants read data and point any mutation at a stub; the question is how it
looks, not whether the backend works.

## When the question is how it looks

A question about palette, type, density, or tone needs variants finished
enough to judge, or a broken render loses a good idea: readable contrast, real
content at its shortest and longest, visible focus, and the states the screen
has (empty, loading, error). The variants differ in what organizes the screen,
not in a color swap. Look at each one rendered before handing over the URL,
for example with `layout-check.mjs` from `../verify/references/checks.md` and
the host's accessibility tooling for contrast.
