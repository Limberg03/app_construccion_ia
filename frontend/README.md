```powershell
cd frontend
npm install
npm install react-konva ( o algo asi, buscarlo con copilot si no, es para el canvas del editor)
npm install jspdf


@"
VITE_API_URL=http://127.0.0.1:8000
"@ | Set-Content .env -Encoding UTF8

npm run dev
npm run build
```
