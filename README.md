# Automation Builder

מערכת אוטומציות אישית עם NLP + אינטגרציה לגוגל.

## מבנה הפרויקט
- **backend/** – שרת Node.js (Express)
- **frontend/** – React UI
- **public/** – קבצי HTML (wizard_plus.html)
- **routes/** – API endpoints (google, plan, automations, nlp)

## הפעלה מקומית
```powershell
# התקנת חבילות
cd backend
npm install

cd ../frontend
npm install

# הפעלת backend
cd ../backend
node server.js

# הפעלת frontend
cd ../frontend
npm start
