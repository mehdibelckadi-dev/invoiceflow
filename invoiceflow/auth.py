"""
InvoiceFlow — Authentication via Clerk
https://clerk.com

Flow:
  Browser → Clerk hosted login → JWT token
  JWT → Authorization: Bearer <token> header on every request
  FastAPI middleware → verifies token → injects user_id into request state

Setup (5 min):
  1. clerk.com → crear cuenta → crear aplicación
  2. Copiar CLERK_SECRET_KEY y CLERK_PUBLISHABLE_KEY al .env
  3. En Clerk dashboard: configurar dominio de producción
"""
from __future__ import annotations

import os
from functools import lru_cache
from typing import Optional

import httpx
from fastapi import HTTPException, Request, status
from fastapi.responses import RedirectResponse

# ── Constants ──────────────────────────────────────────────────────────────────
CLERK_API_BASE  = "https://api.clerk.com/v1"
CLERK_JWKS_URL  = "https://api.clerk.com/v1/jwks"
PUBLIC_PATHS    = {
    "/health",
    "/login",
    "/register",
    "/api/email/inbound",   # webhook — has its own auth
    "/static",
    "/favicon.ico",
}


# ── JWT verification ───────────────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _get_jwks_client():
    """Cached JWKS client — fetches Clerk public keys once."""
    try:
        from jwt import PyJWKClient
        secret_key = os.getenv("CLERK_SECRET_KEY", "")
        # Clerk JWKS endpoint requires the secret key in the header
        return PyJWKClient(
            CLERK_JWKS_URL,
            headers={"Authorization": f"Bearer {secret_key}"},
        )
    except ImportError:
        return None


def verify_session_token(token: str) -> dict:
    """
    Verify a Clerk session JWT and return the payload.
    Raises HTTPException 401 if invalid.
    """
    try:
        import jwt as pyjwt

        client = _get_jwks_client()
        if client is None:
            raise HTTPException(500, "PyJWT not installed")

        signing_key = client.get_signing_key_from_jwt(token)
        payload = pyjwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        return payload

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid session token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def extract_user_id(payload: dict) -> str:
    """Extract the Clerk user ID (sub claim) from JWT payload."""
    user_id = payload.get("sub", "")
    if not user_id:
        raise HTTPException(401, "Missing user ID in token")
    return user_id


# ── FastAPI middleware ─────────────────────────────────────────────────────────

class ClerkAuthMiddleware:
    """
    Middleware that:
    - Skips PUBLIC_PATHS
    - Reads Authorization: Bearer <token> header
    - Falls back to __session cookie (Clerk sets this in the browser)
    - Injects request.state.user_id on success
    - Redirects to /login on browser requests, returns 401 on API requests
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope, receive)
        path    = request.url.path

        # Allow public paths
        if any(path.startswith(p) for p in PUBLIC_PATHS):
            await self.app(scope, receive, send)
            return

        # Dev mode bypass — if no Clerk keys configured, skip auth
        if not os.getenv("CLERK_SECRET_KEY"):
            scope["state"] = scope.get("state", {})
            scope["state"]["user_id"]    = "dev_user"
            scope["state"]["user_email"] = "dev@localhost"
            await self.app(scope, receive, send)
            return

        # Extract token
        token = _extract_token(request)

        if not token:
            response = _auth_redirect_or_401(request)
            await response(scope, receive, send)
            return

        try:
            payload = verify_session_token(token)
            user_id = extract_user_id(payload)
            # Inject into request state
            scope["state"] = scope.get("state", {})
            scope["state"]["user_id"]    = user_id
            scope["state"]["user_email"] = payload.get("email", "")
            await self.app(scope, receive, send)

        except HTTPException:
            response = _auth_redirect_or_401(request)
            await response(scope, receive, send)


def _extract_token(request: Request) -> Optional[str]:
    """Try Authorization header, then __session cookie."""
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    # Clerk browser SDK sets this cookie automatically
    return request.cookies.get("__session")


def _auth_redirect_or_401(request: Request):
    """API requests get 401; browser requests redirect to /login."""
    accept = request.headers.get("accept", "")
    is_browser = "text/html" in accept
    if is_browser:
        return RedirectResponse(url="/login", status_code=302)
    from fastapi.responses import JSONResponse
    return JSONResponse({"detail": "Not authenticated"}, status_code=401)


# ── Dependency for route handlers ──────────────────────────────────────────────

def get_current_user(request: Request) -> str:
    """
    FastAPI dependency — returns user_id.
    Usage:
        @app.get("/api/something")
        async def handler(user_id: str = Depends(get_current_user)):
            ...
    """
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(401, "Not authenticated")
    return user_id


# ── Clerk REST API helpers ─────────────────────────────────────────────────────

async def get_clerk_user(user_id: str) -> dict:
    """Fetch user profile from Clerk API."""
    secret_key = os.getenv("CLERK_SECRET_KEY", "")
    if not secret_key:
        return {"id": user_id, "email": "unknown"}

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{CLERK_API_BASE}/users/{user_id}",
            headers={"Authorization": f"Bearer {secret_key}"},
        )
        if resp.status_code == 200:
            data = resp.json()
            emails = data.get("email_addresses", [])
            primary = next((e["email_address"] for e in emails
                           if e["id"] == data.get("primary_email_address_id")), "")
            return {
                "id":         user_id,
                "email":      primary,
                "first_name": data.get("first_name", ""),
                "last_name":  data.get("last_name", ""),
                "image_url":  data.get("image_url", ""),
            }
    return {"id": user_id, "email": "unknown"}
