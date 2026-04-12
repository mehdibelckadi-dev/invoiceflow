# ⚡ InvoiceFlow

> Sube una factura PDF → Claude extrae todos los datos → aparece en tu dashboard y Google Sheets.  
> Para freelancers y autónomos que odian introducir facturas a mano.

---

## ¿Qué hace?

1. **Subes** una factura (PDF, JPG, PNG) — desde el navegador o arrastrando a una carpeta
2. **Claude extrae** automáticamente: proveedor, NIF, fecha, concepto, base imponible, IVA, total, categoría
3. Los datos aparecen en el **dashboard web** y se exportan a **Google Sheets**
4. Historial completo, filtros por estado, y confianza de extracción por factura

---

## Instalación

```bash
# 1. Clona o descarga
git clone https://github.com/tu-usuario/invoiceflow
cd invoiceflow

# 2. Instala (Python 3.11+)
pip install -e .
# o con pipx:
pipx install .

# 3. Configura
cp .env.example .env
# Edita .env y añade tu ANTHROPIC_API_KEY

# 4. Arranca
invoiceflow
# → Abre http://localhost:8000
```

---

## Configuración mínima (.env)

```env
ANTHROPIC_API_KEY=sk-ant-...
MY_COMPANY_NAME=Tu Nombre o Empresa
MY_TAX_ID=12345678A
```

Eso es todo para empezar. Google Sheets es opcional.

---

## Google Sheets (opcional)

1. Ve a [console.cloud.google.com](https://console.cloud.google.com)
2. Crea un proyecto → activa **Google Sheets API** y **Google Drive API**
3. Crea una **Service Account** → descarga el JSON de credenciales
4. **Comparte** tu spreadsheet con el email de la service account
5. Añade al `.env`:

```env
GOOGLE_CREDENTIALS_FILE=credentials.json
SPREADSHEET_ID=<id del spreadsheet en la URL>
SHEET_NAME=Facturas
```

---

## Carpeta vigilada (auto-proceso)

```env
WATCH_FOLDER=/Users/tu-nombre/Downloads/Facturas
```

Cualquier PDF o imagen que caigas en esa carpeta se procesa automáticamente.

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| IA / Extracción | Claude (Anthropic API) — vision + text |
| Backend | FastAPI + uvicorn |
| Base de datos | SQLite (aiosqlite) |
| Frontend | HTML + htmx (sin build step) |
| Export | gspread (Google Sheets API) |
| PDF parsing | PyMuPDF |
| Watch | watchdog |

---

## Roadmap

- [ ] Email ingestion (reenvía factura → se procesa)
- [ ] Export a CSV / Contasol / Holded
- [ ] Reglas personalizadas de categorización
- [ ] Modo multi-usuario con autenticación
- [ ] App móvil (foto de ticket → extracción)

---

## Licencia

MIT
