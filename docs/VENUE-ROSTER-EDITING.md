# The Midnight Eclipse — staff and thrall roster

The public venue roster lives at **/venue/people/**. It is built from [public/venue-roster.json](../venue-roster.json), not hardcoded in React.

## Updating the roster without changing website code

1. Open [the roster file on GitHub](https://github.com/evelynrose20/eclipse-order-dashboard/blob/main/public/venue-roster.json) while signed into an account with write permission.
2. Click the pencil **Edit this file** icon.
3. Edit the entries inside the `staff` or `thralls` list. Each entry has a unique `id`, display `name`, `title`, `description`, and `image`. Use `"vacancy": true` for an open role; omit it or set `false` for a named character.
4. To add someone, copy one complete entry, separate it from its neighbor with a comma, and choose a new unique `id`. To remove a person, delete their complete entry and preserve valid JSON syntax. You can reorder entries freely.
5. Click **Commit changes**. GitHub Pages redeploys the public website. It reloads the roster when visitors open or refocus the page; no React or API deployment is required.

Only publish a character's name, picture and information if the player is happy to have those details public. Do not put private Discord IDs, OOC details, consent preferences or personal data into this file.

### Uploading a character picture

- Put a JPG, PNG, or WEBP image into [public/venue-images](../venue-images) using GitHub's **Add file → Upload files** action.
- Set that entry's `image` to the exact filename, for example `"image": "elira-sakurai.jpg"`.
- Commit both changes. The image appears as a wide landscape card photo after deployment; if the file isn't uploaded, the Order emblem remains visible.
- The original Carrd portraits cannot be extracted in original resolution from the screenshots, so upload the original images for best quality.

The initial listing reflects the supplied Carrd screenshot: Elira Sakurai and Kaede Akazaya, two staff openings, and four thrall openings. Update roles or descriptions in the JSON whenever their status changes.

This workflow is **GitHub-managed**, not an in-dashboard editor. Editing requires repository permission; ordinary visitors cannot change the roster.
