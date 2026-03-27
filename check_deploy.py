#!/usr/bin/env python3
"""
InvoiceFlow — Pre-deploy check
Ejecuta esto antes de hacer push para verificar que todo está listo.

  python check_deploy.py
"""
import os, sys
from pathlib import Path

ROOT = Path(__file__).parent

# ── Colors ────────────────────────────────────────────────────────────────────
G = "\033[92m"  # green
R = "\033[91m"  # red
Y = "\033[93m"  # yellow
B = "\033[94m"  # blue
D = "\033[0m"   # reset
BOLD = "\033[1m"

def ok(msg):   print(f"  {G}✓{D}  {msg}")
def err(msg):  print(f"  {R}✗{D}  {msg}"); return False
def warn(msg): print(f"  {Y}⚠{D}  {msg}")
def info(msg): print(f"  {B}→{D}  {msg}")

print(f"\n{BOLD}⚡ InvoiceFlow — Pre-deploy check{D}\n")

errors = 0

# ── 1. Required files ─────────────────────────────────────────────────────────
print(f"{BOLD}Archivos requeridos{D}")
required_files = [
    "pyproject.toml",
    "railway.toml",
    "nixpacks.toml",
    "Procfile",
    ".gitignore",
    "invoiceflow/__init__.py",
    "invoiceflow/main.py",
    "invoiceflow/config.py",
    "invoiceflow/auth.py",
    "invoiceflow/billing.py",
    "invoiceflow/db.py",
    "invoiceflow/extractor.py",
    "invoiceflow/models.py",
    "invoiceflow/processor.py",
    "invoiceflow/share.py",
    "invoiceflow/vat.py",
    "invoiceflow/ticket_extractor.py",
    "invoiceflow/ticket_request.py",
    "invoiceflow/email_inbound.py",
    "invoiceflow/sheets.py",
    "templates/dashboard.html",
    "templates/login.html",
    "templates/pricing.html",
    "templates/capture.html",
    "templates/gestor.html",
    "templates/vat_dashboard.html",
    "static/manifest.json",
    "static/sw.js",
]
for f in required_files:
    p = ROOT / f
    if p.exists():
        ok(f)
    else:
        err(f"FALTA: {f}")
        errors += 1

# ── 2. .env check ─────────────────────────────────────────────────────────────
print(f"\n{BOLD}Variables de entorno (.env){D}")
env_file = ROOT / ".env"
if not env_file.exists():
    warn(".env no existe — usando variables del sistema (ok en Railway)")
    env_vars = dict(os.environ)
else:
    # Parse .env
    env_vars = dict(os.environ)
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            env_vars[k.strip()] = v.strip()

def check_var(name, required=True, prefix=None):
    global errors
    v = env_vars.get(name, "")
    if v and (not prefix or v.startswith(prefix)):
        ok(f"{name} ✓")
        return True
    elif v:
        warn(f"{name} existe pero formato inesperado (esperado: {prefix}...)")
        return True
    elif required:
        err(f"{name} — REQUERIDA, no configurada")
        errors += 1
        return False
    else:
        warn(f"{name} — opcional, no configurada")
        return False

check_var("ANTHROPIC_API_KEY",     required=True,  prefix="sk-ant-")
check_var("CLERK_PUBLISHABLE_KEY", required=False, prefix="pk_")
check_var("CLERK_SECRET_KEY",      required=False, prefix="sk_")
check_var("STRIPE_SECRET_KEY",     required=False, prefix="sk_")
check_var("STRIPE_WEBHOOK_SECRET", required=False, prefix="whsec_")
check_var("STRIPE_PRICE_STARTER",  required=False, prefix="price_")
check_var("STRIPE_PRICE_PRO",      required=False, prefix="price_")

# ── 3. .gitignore safety ──────────────────────────────────────────────────────
print(f"\n{BOLD}Seguridad — archivos que NO deben ir al repo{D}")
gitignore = (ROOT / ".gitignore").read_text() if (ROOT / ".gitignore").exists() else ""
dangerous = [".env", "credentials.json", "*.pem", "*.key"]
for f in dangerous:
    if f in gitignore:
        ok(f"{f} está en .gitignore")
    else:
        err(f"{f} NO está en .gitignore — riesgo de exponer secretos")
        errors += 1

# Check .env is not tracked by git
try:
    import subprocess
    result = subprocess.run(
        ["git", "ls-files", ".env"],
        capture_output=True, text=True, cwd=ROOT
    )
    if result.stdout.strip():
        err(".env está siendo tracked por git — ejecuta: git rm --cached .env")
        errors += 1
    else:
        ok(".env no está en git ✓")
except Exception:
    warn("No se pudo verificar git status")

# ── 4. Python syntax check ────────────────────────────────────────────────────
print(f"\n{BOLD}Sintaxis Python{D}")
import py_compile
py_files = list((ROOT / "invoiceflow").glob("*.py"))
syntax_errors = 0
for f in py_files:
    try:
        py_compile.compile(str(f), doraise=True)
    except py_compile.PyCompileError as e:
        err(f"Error de sintaxis en {f.name}: {e}")
        syntax_errors += 1
        errors += 1
if syntax_errors == 0:
    ok(f"{len(py_files)} archivos Python sin errores de sintaxis")

# ── 5. Dependencies ───────────────────────────────────────────────────────────
print(f"\n{BOLD}Dependencias en pyproject.toml{D}")
pyproject = (ROOT / "pyproject.toml").read_text()
required_deps = [
    "fastapi", "uvicorn", "anthropic", "pydantic",
    "pydantic-settings", "aiosqlite", "jinja2",
    "python-multipart", "watchdog", "PyMuPDF",
]
for dep in required_deps:
    if dep.lower() in pyproject.lower():
        ok(dep)
    else:
        err(f"Falta dependencia: {dep}")
        errors += 1

# ── 6. Railway config ─────────────────────────────────────────────────────────
print(f"\n{BOLD}Configuración Railway{D}")
railway_cfg = (ROOT / "railway.toml").read_text()
if "healthcheckPath" in railway_cfg:
    ok("Health check configurado")
else:
    warn("Health check no configurado en railway.toml")

if "startCommand" in railway_cfg:
    ok("Start command configurado")
else:
    err("Falta startCommand en railway.toml")
    errors += 1

# ── Summary ───────────────────────────────────────────────────────────────────
print(f"\n{'─'*50}")
if errors == 0:
    print(f"\n{G}{BOLD}✅ Todo listo para deploy{D}\n")
    print("Próximos pasos:")
    info("git add . && git commit -m 'Ready for deploy'")
    info("git push origin main")
    info("Railway detectará el push y hará deploy automático")
    print()
else:
    print(f"\n{R}{BOLD}✗ {errors} error(s) — corrige antes de hacer deploy{D}\n")
    print("Lee DEPLOY.md para instrucciones detalladas.")
    print()

sys.exit(0 if errors == 0 else 1)
