"""Same-origin access to the LalaFlow backend: /api/<path> on this server is forwarded to the backend.

Exposing only this server (e.g. one ngrok tunnel) is then enough: the browser never has to reach the backend's own
port, which from a phone on the internet would mean the phone's own localhost.
"""

import asyncio
import logging
import urllib.error
import urllib.request

from fastapi import APIRouter, HTTPException, Request, Response

logger = logging.getLogger("speech-service.lalaflow-proxy")

API_PREFIX = "/api"
# Admin product uploads allow 5 images x 5 MB.
MAX_BODY_BYTES = 26 * 1024 * 1024
# The chat endpoint waits on an LLM; give it room before the visitor sees a gateway error.
UPSTREAM_TIMEOUT_SECONDS = 90
PROXIED_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
# Connection-level headers belong to one hop and must not be copied across the proxy.
HOP_BY_HOP_HEADERS = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer",
    "transfer-encoding", "upgrade", "host", "content-length",
}


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Pass upstream redirects to the browser instead of following them on the server."""

    def redirect_request(self, *args, **kwargs):
        return None


_opener = urllib.request.build_opener(_NoRedirect)


def _forward(method: str, url: str, headers: dict[str, str], body: bytes | None):
    request = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with _opener.open(request, timeout=UPSTREAM_TIMEOUT_SECONDS) as response:
            return response.status, response.headers.items(), response.read()
    except urllib.error.HTTPError as error:
        # 4xx/5xx from the backend are answers, not proxy failures: hand them through unchanged.
        return error.code, error.headers.items(), error.read()


def _forwarded_for(request: Request) -> str:
    """Append the address we received from, so the backend (with TRUST_PROXY) can see the real visitor."""
    client = request.client.host if request.client else ""
    prior = request.headers.get("x-forwarded-for")
    return f"{prior}, {client}" if prior else client


def create_lalaflow_router(upstream: str) -> APIRouter:
    router = APIRouter()
    base = upstream.rstrip("/")

    @router.api_route(f"{API_PREFIX}/{{path:path}}", methods=PROXIED_METHODS, include_in_schema=False)
    async def proxy(path: str, request: Request) -> Response:
        body = await request.body()
        if len(body) > MAX_BODY_BYTES:
            raise HTTPException(413, f"request body {len(body)} bytes exceeds {MAX_BODY_BYTES}")

        url = f"{base}/{path}" + (f"?{request.url.query}" if request.url.query else "")
        headers = {name: value for name, value in request.headers.items() if name.lower() not in HOP_BY_HOP_HEADERS}
        headers["X-Forwarded-For"] = _forwarded_for(request)
        headers["X-Forwarded-Proto"] = request.headers.get("x-forwarded-proto", request.url.scheme)

        try:
            status, upstream_headers, content = await asyncio.to_thread(
                _forward, request.method, url, headers, body or None)
        except (urllib.error.URLError, TimeoutError) as error:
            logger.error("LalaFlow backend unreachable: %s %s -> %s", request.method, url, error)
            raise HTTPException(502, f"LalaFlow backend at {base} is unreachable")

        response = Response(content=content, status_code=status)
        for name, value in upstream_headers:
            if name.lower() not in HOP_BY_HOP_HEADERS:
                response.headers.append(name, value)
        return response

    return router
