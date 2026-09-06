# LoL Match Review

![Node.js](https://img.shields.io/badge/Node.js-20+-339933)
![Local first](https://img.shields.io/badge/Data-local--first-2563eb)
![License](https://img.shields.io/badge/License-MIT-green)

Local-first League of Legends match review dashboard. It connects to a locally running League Client, collects ranked match data through LCU/SGP endpoints, and turns multi-match history into evidence-based player reports.

The project is designed for personal review and coaching workflows: select friends, choose ranked queues, collect match samples, inspect trends, and export CSV/JSON without uploading private game data to a server.

## Features

- Local HTTP dashboard powered by Node.js, with no database service required.
- League Client lockfile discovery and LCU authentication from the local process only.
- SGP-first collection with LCU fallback for detailed ranked match history.
- Ranked queue filtering for solo/duo and flex queue.
- Built-in demo dataset, so the UI can be explored without logging in to League.
- Evidence-style reports with KDA trend, win rate, role breakdowns, champion splits, participant tables, timeline events, and coaching suggestions.
- Optional OpenAI-powered deep review through environment variables.
- CSV/JSON export for target-player records and full participant tables.

## Privacy Boundary

This repository intentionally excludes local runtime data.

- `data/` is ignored except for `.gitkeep`.
- Static generated reports and real player archives are not included.
- The app reads the local League Client lockfile at runtime and does not store the client password/token in source files.
- Optional OpenAI API keys are read from environment variables only.
- The app does not read chat content and does not modify game state.

## Quick Start

Requirements:

- Windows
- Node.js 20 or newer
- League of Legends client, if you want to collect real local data

```powershell
npm install
npm start
```

Open:

```text
http://127.0.0.1:3790
```

To explore without the League Client, click `查看演示数据` in the UI.

## Environment

If automatic lockfile discovery does not find the client, set the lockfile path explicitly:

```powershell
$env:LOL_LOCKFILE = 'C:\Riot Games\League of Legends\lockfile'
$env:LOL_REGION = 'TENCENT'
$env:LOL_RSO_PLATFORM_ID = 'HN1'
npm start
```

Optional AI review:

```cmd
set OPENAI_API_KEY=your_api_key
set OPENAI_MODEL=gpt-4o-mini
npm start
```

When `OPENAI_API_KEY` is not set, the dashboard still provides the built-in local review and training plan.

## Workflow

1. Open the dashboard and load demo data or local client friends.
2. Select one or more players.
3. Choose ranked queues and match count.
4. Collect match data from SGP/LCU.
5. Review trends, role/champion breakdowns, timeline evidence, and recommendations.
6. Export CSV or JSON when needed.

## Project Structure

```text
server.mjs      Local HTTP server, LCU/SGP collection, analysis engine
public/         Dashboard UI
tools/          Local data migration and compaction helpers
data/           Runtime cache, ignored by Git
```

## Notes

This is an unofficial local tool and is not endorsed by Riot Games. League of Legends and Riot Games are trademarks or registered trademarks of Riot Games, Inc.

## License

MIT. See [LICENSE](LICENSE).
