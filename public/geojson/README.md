# GeoJSON Data Files

This directory contains geographic boundary data for the Muslim Voter Impact Map.

## Files

### us-states.json
- **Source**: [PublicaMundi MappingAPI](https://github.com/PublicaMundi/MappingAPI)
- **Features**: 52 (50 US states + DC + Puerto Rico)
- **Properties**: `name`, `density`

### congressional-districts-118.json
- **Source**: [eric.clst.org](https://eric.clst.org/tech/usgeojson/)
- **Features**: 437 congressional districts
- **Properties**: `GEO_ID`, `STATE`, `CD`, `NAME`, `LSAD`, `CENSUSAREA`
- **Note**: This data is from the 2010 redistricting cycle. For production use with
  the 118th Congress (2023-2025), consider updating with official Census Bureau
  TIGER/Line data for the 118th congressional districts.

## Updating Congressional Districts

For the most accurate 118th Congress district boundaries, you can download from:
1. [Census Bureau TIGER/Line](https://www.census.gov/cgi-bin/geo/shapefiles/index.php?year=2023&layergroup=Congressional+Districts)
2. Convert the shapefile to GeoJSON using tools like `ogr2ogr` or mapshaper.org

```bash
# Example using ogr2ogr (requires GDAL)
ogr2ogr -f GeoJSON congressional-districts-118.json tl_2023_us_cd118.shp
```
