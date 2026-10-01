# Brain Rush

A 2–8 player real-time multiplayer party game built for Netlify Functions + Netlify Blobs.

## Game rules
- Create a room and share the 5-character code.
- At least 2 players are required; up to 8 can join.
- The host starts the game.
- There are 3 rounds.
- Each round presents one engineering multiple-choice challenge.
- Every player submits one answer.
- Correct answers earn points; among correct players, earlier answers earn more.
- When everyone has answered, the round results appear.
- After round 3, the player with the highest total score wins.

## Architecture
- Frontend: plain HTML/CSS/JS in `public/`.
- Multiplayer state: `netlify/functions/game.ts`.
- Persistent room state: Netlify Blobs with strong consistency and optimistic conditional writes using ETags.
- The browser calls `/.netlify/functions/game` directly.

## Netlify
Upload the project to a Netlify site. Netlify will use `netlify.toml` to publish `public/` and discover the function in `netlify/functions/`.

No separate database or API key is required for the deployed Netlify Function because Netlify Blobs is integrated with Functions.

## Important build note
A package-lock file was not fabricated because this build environment could not reliably download npm package metadata. Netlify can install from the included `package.json`; if your workflow requires a lockfile, generate it with your normal npm install workflow before deployment.
