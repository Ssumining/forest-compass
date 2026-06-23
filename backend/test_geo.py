import asyncio, json
from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(".env"))
from main import analyze_geo, GeoRequest

async def test():
    req = GeoRequest(lat=37.88276, lng=127.54719, parcelAreaHa=0.0274, siteClassification="임업용산지")
    result = await analyze_geo(req)
    slopes = [c["slope"] for c in result["grid"]]
    src = result["source"]
    avg = sum(slopes)/len(slopes)
    mx = max(slopes)
    consts = result["consts"]
    print(f"source: {src}")
    print(f"avg slope: {avg:.1f}, max: {mx:.1f}")
    print(f"treeDensity: {consts['treeDensity']}, Vunit: {consts['Vunit']}, parcelAreaHa: {consts.get('parcelAreaHa')}")

asyncio.run(test())
