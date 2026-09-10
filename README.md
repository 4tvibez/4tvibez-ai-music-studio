# 4TVIBEZ AI MUSIC STUDIO — LIVE backend

## Important
Do NOT open `index.html` directly from your phone/files app and expect AI generation to work. The browser must be connected to the Node/Express backend.

## Railway
1. Push this whole folder to GitHub.
2. Connect that GitHub repository to Railway.
3. Add Railway Variable: `REPLICATE_API_TOKEN` = your Replicate API token.
4. Deploy.
5. Open the Railway-generated HTTPS URL.
6. Open `/api/health` on that same Railway URL. It should say `provider: replicate`.
7. Use Generate Music from the Railway URL.

## Why the old version could say “Failed to fetch”
If the downloaded HTML is opened as a local file (`file://...`), `/api/generate` does not exist there. The fixed version also creates a Replicate prediction first and polls its status, so the browser does not have to wait on a long generation request.

## Provider
This uses Replicate's official `minimax/music-2.5` model. The current documented model accepts `lyrics`, `prompt`, `bitrate`, `sample_rate`, and `audio_format`. It currently costs $0.15 per output audio file.
