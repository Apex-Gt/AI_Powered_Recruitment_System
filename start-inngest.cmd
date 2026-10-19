@echo off
rem Starts the Inngest dev server the AI service needs (scoring, ranking, summaries, resume ingestion).
rem Leave this window open while you work. Does nothing if Inngest is already running.
rem Uses npx, not Docker, so it does not need the C: drive space the Docker store would.

curl -s -o nul -m 3 http://localhost:8288/ && (
  echo Inngest is already running on http://localhost:8288
  exit /b 0
)

echo Starting Inngest dev server on http://localhost:8288 ...
npx --yes inngest-cli@latest dev -u http://localhost:8000/api/inngest
