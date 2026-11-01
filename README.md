# Signal News

Signal News is a calmer way to keep up with the stories shaping your day. Browse current headlines, tailor your feed to the topics you care about, and save stories to read later.

## Features

- **Personalized feed:** Choose favorite topics and combine their headlines in your **For you** feed. Preferences are saved in your browser.
- **Topic browsing:** Filter the feed by World, Technology, Business, Culture, or Science.
- **Search and sorting:** Search headlines and descriptions, then sort stories by recommended order or publication time.
- **Country editions:** Browse headlines for the United States, United Kingdom, Canada, Australia, or India.
- **Saved stories:** Save articles in your browser and revisit them from **Saved stories**.
- **Daily briefing:** Scan a short list of headlines and open article links from the feed.

## Requirements

- Python 3.9 or later
- A [NewsAPI](https://newsapi.org/) API key

## Run locally

1. Copy `.env.example` to `.env`.
2. Set `NEWSAPI_KEY` in `.env` to your NewsAPI key. Keep this key private; the local server uses it so it is not exposed in browser code.
3. Start the server from the project directory:

   ```bash
   python3 server.py
   ```

4. Open [http://127.0.0.1:8000](http://127.0.0.1:8000).

To use a different local port, set the `PORT` environment variable before starting the server.

## Notes

The app fetches headlines from NewsAPI's Top Headlines endpoint. NewsAPI plan limits and availability apply. Favorite topics and saved stories are stored locally in the current browser and are not synced between devices.
