"""
Auth — TDD §14: AWS Cognito JWT verification with per-role claim scoping.

Accepts both Cognito access tokens and ID tokens. Every token must pass:
signature (Cognito JWKS), expiry, issuer (our user pool), token type, and
app-client match (access token -> `client_id`, ID token -> `aud`).
"""
from typing import Any

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt
from jose.exceptions import JOSEError, JWTError

from app.config import get_settings

settings = get_settings()
bearer_scheme = HTTPBearer(auto_error=True)

_jwks_cache: dict[str, Any] = {}


def _issuer() -> str:
    return f"https://cognito-idp.{settings.cognito_region}.amazonaws.com/{settings.cognito_user_pool_id}"


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


async def decode_cognito_token(token: str) -> dict[str, Any]:
    """Verify a Cognito JWT and return its claims. Raises JOSEError on any failure."""
    header = jwt.get_unverified_header(token)
    kid = header.get("kid")
    if kid is None:
        raise JWTError("Invalid token header")

    signing_key = await _get_signing_key(kid)
    if signing_key is None:
        raise JWTError("Unable to verify token signature")

    claims = jwt.decode(
        token,
        signing_key,
        algorithms=["RS256"],
        issuer=_issuer(),
        options={"verify_aud": False, "verify_at_hash": False, "verify_exp": True},
    )

    token_use = claims.get("token_use")
    if token_use == "access":
        client = claims.get("client_id")
    elif token_use == "id":
        client = claims.get("aud")
    else:
        raise JWTError("Unsupported token_use")
    if client != settings.cognito_app_client_id:
        raise JWTError("Token was not issued for this app client")

    return claims


class AuthenticatedUser:
    def __init__(self, sub: str, role: str, claims: dict[str, Any]):
        self.sub = sub
        self.role = role
        self.claims = claims


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AuthenticatedUser:
    try:
        claims = await decode_cognito_token(credentials.credentials)
    except JOSEError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid or expired token: {exc}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Unable to fetch Cognito signing keys") from exc

    groups = claims.get("cognito:groups") or []
    role = claims.get("custom:role") or (groups[0] if groups else None)
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