"""
Auth — TDD §14: "AWS Cognito (4 roles: Customer, Owner, Warehouse Staff,
Rider) — Managed JWT issuance with OTP/MFA support and per-role claim
scoping." The NLU half is customer-facing (voice/chat ordering), so its
endpoints accept `customer` role tokens; internal service-to-service calls
(e.g. a dialogue manager calling on a customer's behalf) use a service
role claim instead.

JWKS is fetched once and cached; production Cognito key rotation is
handled by re-fetching on a `kid` cache-miss rather than a fixed TTL.
"""
from typing import Any

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from jose.exceptions import JOSEError

from app.config import get_settings

settings = get_settings()
bearer_scheme = HTTPBearer(auto_error=True)

_jwks_cache: dict[str, Any] = {}


async def _get_jwks() -> dict[str, Any]:
    global _jwks_cache
    if not _jwks_cache:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(settings.cognito_jwks_url)
            resp.raise_for_status()
            _jwks_cache = resp.json()
    return _jwks_cache


async def _get_signing_key(kid: str) -> dict[str, Any] | None:
    jwks = await _get_jwks()
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    # kid not found — force a refresh once in case of key rotation
    global _jwks_cache
    _jwks_cache = {}
    jwks = await _get_jwks()
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return key
    return None


class AuthenticatedUser:
    def __init__(self, sub: str, role: str, claims: dict[str, Any]):
        self.sub = sub
        self.role = role
        self.claims = claims


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AuthenticatedUser:
    token = credentials.credentials
    try:
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        if kid is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token header")

        signing_key = await _get_signing_key(kid)
        if signing_key is None:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Unable to verify token signature")

        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256"],
            audience=settings.cognito_app_client_id,
            options={"verify_exp": True},
        )
    except JOSEError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid or expired token: {exc}") from exc

    role = claims.get("custom:role") or claims.get("cognito:groups", [None])[0]
    if role is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Token carries no role claim")

    return AuthenticatedUser(sub=claims["sub"], role=role, claims=claims)


def require_roles(*allowed_roles: str):
    """Dependency factory: `Depends(require_roles("customer", "owner"))`."""

    async def _checker(user: AuthenticatedUser = Depends(get_current_user)) -> AuthenticatedUser:
        if user.role not in allowed_roles:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"Role '{user.role}' is not permitted to perform this action",
            )
        return user

    return _checker
