import asyncio
import json
import os
import random
from typing import Optional

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

# Environment configuration
LLM_API_KEY = os.getenv("LLM_API_KEY")
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://openrouter.ai/api/v1")
LLM_MODEL = os.getenv("LLM_MODEL", "openai/gpt-4o-mini")

# Shared state for SSE
event_queues: set = set()

# Мок-критик чередует PASS/REWORK (docs/07), не random — демо предсказуемо
_critic_toggle = False


def err(status: int, msg: str) -> JSONResponse:
    # Контракт docs/07: ошибки провайдера/сети → { "error": ... }
    return JSONResponse(status_code=status, content={"error": msg})

# FastAPI app
app = FastAPI()

# CORS middleware for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/llm")
async def llm_endpoint(request: Request):
    """
    POST /llm — LLM API proxy with mock fallback.

    Input: { system?: string, prompt: string, tools?: string[] }
    Output: { text: string, mock?: true }
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    prompt = body.get("prompt", "").strip()
    system = body.get("system", "").strip()
    tools = body.get("tools", [])

    if not prompt:
        raise HTTPException(status_code=400, detail="prompt is required")

    # Check if we have an API key for real calls
    if not LLM_API_KEY:
        # Mock mode
        global _critic_toggle
        await asyncio.sleep(1.5)

        if system and "PASS" in system:
            # Критик: чередуем PASS/REWORK (docs/07)
            _critic_toggle = not _critic_toggle
            text = "PASS" if _critic_toggle else "REWORK: needs improvement"
        elif "YES or NO" in prompt or "YES или NO" in prompt:
            text = random.choice(["YES", "NO"])
        elif "web-search" in tools:
            text = f"[mock][web-search] {prompt[:200]}"
        else:
            text = f"[mock] {prompt[:200]}"

        return {"text": text, "mock": True}

    # Real API call
    try:
        model = LLM_MODEL

        # Add :online suffix for web-search on OpenRouter
        if "web-search" in tools and "openrouter" in LLM_BASE_URL.lower():
            model = f"{LLM_MODEL}:online"

        headers = {
            "Authorization": f"Bearer {LLM_API_KEY}",
            "Content-Type": "application/json",
        }

        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": model,
            "max_tokens": 1024,
            "messages": messages,
        }

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{LLM_BASE_URL}/chat/completions",
                headers=headers,
                json=payload,
            )

            if response.status_code != 200:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get("error", {}).get("message", error_detail)
                except Exception:
                    pass
                return err(502, f"LLM error: {error_detail}")

            data = response.json()
            text = data.get("choices", [{}])[0].get("message", {}).get("content", "")

            return {"text": text}

    except HTTPException:
        raise
    except Exception as e:
        return err(502, f"LLM error: {str(e)}")


@app.post("/proxy")
async def proxy_endpoint(request: Request):
    """
    POST /proxy — SSRF proxy for external requests.

    Input: { url, method?: string, headers?: dict, body?: any }
    Output: { status: int, body: any }
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    url = body.get("url")
    if not url:
        raise HTTPException(status_code=400, detail="url is required")

    method = body.get("method", "GET").upper()
    headers = body.get("headers", {})
    req_body = body.get("body")

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            if method == "GET":
                response = await client.get(url, headers=headers)
            elif method == "POST":
                response = await client.post(url, headers=headers, json=req_body)
            elif method == "PUT":
                response = await client.put(url, headers=headers, json=req_body)
            elif method == "DELETE":
                response = await client.delete(url, headers=headers)
            else:
                raise HTTPException(status_code=400, detail=f"Unsupported method: {method}")

            # Try to parse response as JSON, fallback to text
            try:
                resp_body = response.json()
            except Exception:
                resp_body = response.text

            return {"status": response.status_code, "body": resp_body}

    except HTTPException:
        raise
    except Exception as e:
        return err(502, f"Proxy error: {str(e)}")


@app.post("/webhook/{node_id}")
async def webhook_endpoint(node_id: str, request: Request):
    """
    POST /webhook/{node_id} — Webhook receiver with SSE broadcast.

    Input: any JSON or raw text
    Output: { ok: true }
    """
    try:
        body = await request.json()
    except Exception:
        # Fall back to raw text
        body = {"raw": (await request.body()).decode("utf-8", errors="replace")}

    # Broadcast to all SSE clients
    event_data = {
        "type": "webhook",
        "nodeId": node_id,
        "body": body,
    }

    # list(): set может мутировать (finally в /events) во время обхода
    for queue in list(event_queues):
        queue.put_nowait(event_data)

    return {"ok": True}


@app.get("/events")
async def events_stream():
    """
    GET /events — SSE stream for webhook and other events.
    """
    queue: asyncio.Queue = asyncio.Queue()
    event_queues.add(queue)

    async def event_generator():
        try:
            while True:
                try:
                    # 15-second heartbeat timeout
                    event_data = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"data: {json.dumps(event_data)}\n\n"
                except asyncio.TimeoutError:
                    # Send heartbeat ping
                    yield ": ping\n\n"
        finally:
            event_queues.discard(queue)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8787)
