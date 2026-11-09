SharpGrotesk20 (Sharp Grotesk Book 20) - Xsolla brand font
==========================================================

This font is licensed. The body font file in this folder is:

    Sharp Grotesk Book 20 Regular.woff2

src/styles/typography.css names exactly that file. To use a different file, change the name there
(and keep it in this folder): every url() in that stylesheet must point at a file that exists,
otherwise the dev server answers with index.html and the browser logs an "OTS parsing error".
src/styles/typography.test.ts fails when a file is missing.

If the font cannot be loaded, the app falls back to "Hanken Grotesk" and works normally.

Other weights (Medium / Bold): add the files here and add one @font-face per weight in
src/styles/typography.css, then narrow the existing rule's font-weight from "400 700" to "400".

Check that the licence allows bundling the font with this project before committing the files.

Headline font (titles)
----------------------
SharpGroteskSmBold15.woff2 (600, h2-h4) and SharpGroteskBold15.woff2 (700, h1 / page titles) are
the headline cut Xsolla uses on developers.xsolla.com. Declared as "SharpGrotesk15" in
src/styles/typography.css. Body text stays Sharp Grotesk Book 20.
Also check the licence before publishing the app anywhere public.
