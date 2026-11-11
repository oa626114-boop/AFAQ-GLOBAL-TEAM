# AFAQ GLOBAL TEAM

Independent member-registration and team-management project.

## Project structure
- `public/index.html`: member registration page
- `public/admin.html`: owner review page
- `public/config.js`: deployed API URL configuration
- `worker.js`: Cloudflare Worker API
- `schema.sql`: Cloudflare D1 database schema

## Important status
This repository contains starter source code only. It is not a live registration service until the Cloudflare Worker and D1 database are created, configured, and deployed.

## Deployment outline
1. Create a Cloudflare D1 database.
2. Run `schema.sql` in that database.
3. Create a Worker from `worker.js` and bind the database as `DB`.
4. Set the Worker secret `OWNER_ADMIN_TOKEN`.
5. Set a private invitation code in the Worker environment variable `INVITE_CODE`.
6. Update `public/config.js` with the deployed Worker URL.
7. Enable GitHub Pages for the `/public` folder (or deploy `public` to Cloudflare Pages).

Do not store passport scans, identity documents, bank details, or other sensitive documents in this public repository. Add private storage and a proper privacy notice before collecting such data.
