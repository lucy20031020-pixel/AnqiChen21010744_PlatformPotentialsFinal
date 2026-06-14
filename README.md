# Final Project MVS: Why was my post removed?

`Why was my post removed?` is an independent transparency and appeal-support layer for social media platforms such as TikTok, Red Notes, Instagram, YouTube, or any platform that removes, hides, demonetizes, or restricts user content.


## System Layers

```text
final_project/
  frontend/       High-fidelity clickable prototype for users and advocates
  backend/        FastAPI service with explanation, appeal, privacy, and governance logic
  database/       JSON mock database, case records, governance log, and data dictionary
  docs/           Architecture, assessment mapping, and system rationale
```

## Run Locally

### Backend

```bash
cd final_project/backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The API runs at `http://127.0.0.1:8000`.

### Frontend

Open `frontend/index.html` with VSCode Go Live, or open it directly in a browser.

