import asyncio
import logging
from maigret import search as maigret_search
from maigret.sites import MaigretDatabase
from fastapi import FastAPI, HTTPException, Depends, Security
from fastapi.security import APIKeyHeader
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("maigret-worker")

app = FastAPI(title="Maigret Worker", description="Public profile scanning service")
api_key_header = APIKeyHeader(name="X-API-Key")

async def verify_api_key(key: str = Security(api_key_header)):
    expected = os.getenv("MAIGRET_WORKER_SECRET")
    if not expected or key != expected:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return key

@app.get("/health")
async def health():
    return {"status": "healthy", "service": "maigret-worker"}

@app.post("/scan")
async def scan(
    username: str,
    top_sites: int = 500,
    parse: bool = True,
    _: str = Depends(verify_api_key)
):
    """
    Scan public profiles for a given username using Maigret.
    Returns normalized results with platform info and extracted data.
    """
    try:
        logger.info(f"Scanning username: {username}, top_sites={top_sites}, parse={parse}")

        # Load Maigret database
        db = MaigretDatabase().load_from_path("maigret/resources/data.json")
        sites = db.ranked_sites_dict(top=top_sites)
        
        # Run search
        results = await maigret_search(
            username=username,
            site_dict=sites,
            logger=logger,
            timeout=30,
            is_parsing_enabled=parse,
        )
        
        # Normalize results
        platforms = []
        for site_name, result in results.items():
            if result["status"].is_found():
                platform_info = {
                    "platform": site_name,
                    "url": result.get("url_user"),
                    "exists": True,
                    "http_status": result.get("http_status"),
                    "rank": result.get("rank"),
                }
                # Include parsed IDs data if available
                if parse and "ids_data" in result:
                    platform_info["ids_data"] = result["ids_data"]
                platforms.append(platform_info)
        
        confidence = min(len(platforms) * 0.2, 1.0)
        summary = f"Public presence suggests activity on {len(platforms)} platforms" if platforms else "No public profiles found"
        
        return {
            "summary": summary,
            "platforms": platforms,
            "confidence": confidence,
            "username": username,
        }
        
    except Exception as e:
        logger.error(f"Scan error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))