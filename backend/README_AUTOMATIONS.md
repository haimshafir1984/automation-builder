
# Automation Engine — Plan & Execute

This backend turns free text into runnable automations. It exposes:
- `POST /api/plan/from-text` → returns a **pipeline plan** (steps + missing fields)
- `POST /api/automations/dry-run` → simulates the pipeline
- `POST /api/automations/execute` → executes the pipeline

## Quick Start (Windows PowerShell)

```powershell
# 1) Install deps
npm install

# 2) Copy .env.example → .env and fill required credentials
Copy-Item .env.example .env

# 3) Run
node server.js
# Server listening on http://0.0.0.0:5000
```

## Plan from text

```powershell
$body = @{ text = "כל מייל ממשתמש foo@bar.com שלא קיבל מענה 4 שעות → שלח וואטסאפ ל+972501112233 וגם תוסיף לשיט" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://0.0.0.0:5000/api/plan/from-text" -Method Post -ContentType "application/json" -Body $body
```

Response contains:
- `proposal.steps[]` (trigger/actions)
- `missing[]` (parameters you must supply to run)

## Fill missing and dry-run

```powershell
$pipeline = @{
  steps = @(
    @{ trigger = @{ type="gmail.unreplied"; params = @{ fromEmail="foo@bar.com"; hours=4; limit=50 } } },
    @{ action  = @{ type="whatsapp.send";  params = @{ to="+972501112233"; template="sla_breach_basic" } } },
    @{ action  = @{ type="sheets.append";  params = @{ spreadsheetId="SPREADSHEET_ID"; sheetName="sla"; columns=@("from","subject","date") } } }
  )
} | ConvertTo-Json -Depth 6

Invoke-RestMethod -Uri "http://0.0.0.0:5000/api/automations/dry-run" -Method Post -ContentType "application/json" -Body $pipeline
```

## Execute

```powershell
Invoke-RestMethod -Uri "http://0.0.0.0:5000/api/automations/execute" -Method Post -ContentType "application/json" -Body $pipeline
```

### Notes
- Gmail/Sheets require OAuth — see `routes/google.js` and files in `lib/` and `capabilities/adapters/`.
- WhatsApp via Twilio requires `TWILIO_*` environment variables.
- Telegram/Slack require their tokens if you use those actions.
