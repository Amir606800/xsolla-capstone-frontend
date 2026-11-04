SharpGrotesk20 (Sharp Grotesk Book 20) - Xsolla brand font
==========================================================

This font is licensed, so the files are not committed by default.
Get them from Xsolla's brand / design team, then put them in this folder:

    SharpGroteskBook20.woff2     <- preferred (smallest)
    SharpGroteskBook20.woff      <- optional fallback

The app picks them up automatically (see src/styles/typography.css).
No code change, no rebuild of anything else is needed - just refresh the page.

If the files are missing, the app falls back to "Hanken Grotesk" and works normally.
(You may see a 404 for these two files in the browser's Network tab until they exist.)

Other weights (Medium / Bold): add the files here and add one @font-face per weight in
src/styles/typography.css, then narrow the existing rule's font-weight from "400 700" to "400".

Check that the licence allows bundling the font with this project before committing the files.
