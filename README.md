# OGHUB

Step 1: UI & Authentication

build the core layout:

"Create a responsive dashboard for a Suno-powered AI music generator. Include a sidebar for navigation (Home, My Library, Buy Coins). On the Home page, add a text prompt input for the song style and lyrics, a 'Generate' button that shows it costs X coins, and a visible 'Coin Balance' indicator in the header. Use Supabase Auth for user signups."

Step 2: The Suno Integration (Edge Functions)

Because you cannot expose your Suno API key on the frontend, Lovable will need to write a Supabase Edge Function to handle the generation securely.

"Create a Supabase Edge Function to handle Suno API generation. When a user clicks 'Generate', deduct coins from their profile. The Edge Function should call the Suno API, get the audio files, and save the generation details to the songs table."

Step 3: The Preview vs. Download Logic

To handle the 60-second preview safely without users just stealing the full file from the browser network tab:

Option A (Easiest): Use an audio processing tool via an API to chop the first 60 seconds into a separate preview file.

Option B (Frontend lock): Lovable can use a standard audio player that automatically pauses at currentTime >= 60 and pops up a modal: "Enjoying this track? Spend 1 coin to unlock the full high-quality download!"

Step 4: Stripe Coin Purchasing

Lovable has great built-in capabilities for Stripe.

"Create a 'Buy Coins' page with three pricing tiers (e.g., 10 coins for $5, 30 coins for $12). Integrate Stripe Checkout so that when a payment is successful, a Stripe Webhook updates the user's coin_balance in the Supabase profiles table."

3. Important Gotchas to Keep in Mind

Suno Generation Time: Suno takes anywhere from 30 seconds to 2 minutes to generate a song. Your Lovable frontend needs a good "Loading/Generating" state that polls the database or uses Supabase Realtime to update the UI when the song is ready.

Securing the Full Download: When a user spends coins to unlock a song, update a unlocked_songs bridge table. Only expose the full_url download link if the backend verifies the user has unlocked it.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://og-196.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/07659a42-5b68-4c8b-83b5-ee9a625dbb92).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
