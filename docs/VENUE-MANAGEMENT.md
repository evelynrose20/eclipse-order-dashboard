# The Midnight Eclipse — Venue Management

Open the member dashboard (Discord sign-in) and choose **Order Management → Venue Management**. The page is restricted to Domina and High Command on both the frontend and Windows API.

## Staff and thrall listings

- Switch between **Staff** and **Thralls**.
- **Add listing** to create a person or vacant position.
- **Edit** name, role/title, public description, vacancy status, or portrait.
- Use the up/down arrows to change public display order.
- **Remove** deletes a public listing after confirmation, without deleting an Order character sheet or account.
- **Publish changes** makes the updated roster visible at `/venue/people/` through the public API.

## Portraits

Choose **Upload portrait** to send a JPG/PNG/WEBP image up to 2 MB to the Windows API. The API stores it in the persistent `server/venue-uploads/` directory by default. Each upload gets an unguessable filename. The roster stores only its public image path. Image uploads and editing require authenticated command permissions; visitors can only view publicly published pictures. For images already hosted on the web, enter a public HTTPS image URL instead.

**Back up `server/venue-uploads/` alongside the MySQL database.** Set `VENUE_UPLOAD_DIR` to an absolute persistent storage path in your private `server/.env` when appropriate. Do not commit user-uploaded pictures or personal information to GitHub.

## Deployment

This replaces the older GitHub-JSON editing workflow. It reuses the existing `order_settings` table and adds no SQL migration. **Pull the new main branch and restart the Windows API service** before using the dashboard editor; updating GitHub Pages alone does not update the Windows service. The public roster loads from `https://api.rosefires.com/venue/public` and falls back to the initial static roster if the API is unreachable. Reload the public roster page to confirm published changes.

Existing menu food/drink image slots use the static GitHub image folder. The Venue Management portrait uploader is specifically for the public staff/thrall roster; menu editing can be added later.
