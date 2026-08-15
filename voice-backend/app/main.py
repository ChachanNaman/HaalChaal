import logging

from fastapi import FastAPI

from app.routes import demo, voice

logging.basicConfig(level=logging.INFO)

app = FastAPI(title="HaalChaal Voice Backend")

app.include_router(voice.router)
app.include_router(demo.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
