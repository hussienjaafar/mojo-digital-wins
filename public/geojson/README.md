# GeoJSON Data Files

This directory contains geographic boundary data for the Muslim Voter Impact Map.

## Files

### us-states.json
- **Source**: [PublicaMundi MappingAPI](https://github.com/PublicaMundi/MappingAPI)
- **Features**: 52 (50 US states + DC + Puerto Rico)
- **Properties**: `name`, `density`

### congressional-districts-118.json
- **Source**: [JeffreyBLewis/congressional-district-boundaries](https://github.com/JeffreyBLewis/congressional-district-boundaries)
- **Congress**: 119th (2025-2027) - current boundaries after 2020 redistricting
- **Features**: 436 congressional districts
- **Properties**: `GEO_ID`, `STATE`, `CD`, `NAME`, `LSAD`, `CENSUSAREA`
- **Updated**: February 2026

### congressional-districts-118-old.json
- **Source**: [eric.clst.org](https://eric.clst.org/tech/usgeojson/)
- **Congress**: Pre-2013 boundaries (outdated)
- **Note**: Kept for reference only. Do not use.
