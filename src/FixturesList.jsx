import { useState, useEffect } from "react";
import axios from "axios";

// Replace with your actual API base URL and key
const API_BASE = "https://v3.football.api-sports.io/";
const API_KEY = "e071cffd56adbe2ba8bf829368a08ce7";

export default function FixturesList() {
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leagueId, setLeagueId] = useState(39); // Default: Premier League
  // pubInfo stores lookup results per fixture id
  const [pubInfo, setPubInfo] = useState({});
  // Store both the fixture id and the pairing message
  const [beerPairing, setBeerPairing] = useState({ fixtureId: null, message: null });

  useEffect(() => {
    async function fetchFixtures() {
      setLoading(true);
      try {
        const response = await axios.get(
          `${API_BASE}/fixtures?league=${leagueId}&season=2023`,
          {
            headers: { "x-apisports-key": API_KEY },
          }
        );
        console.log("API response:", response.data);
        setFixtures(response.data.response);
      } catch (err) {
        console.error("API error:", err);
        setError("Failed to load fixtures.");
      } finally {
        setLoading(false);
      }
    }
    fetchFixtures();
  }, [leagueId]);

  const suggestBeer = (home, away, fixtureId, fixtureVenueName) => {
    // Simple demo logic for pairing beer types
    // Accept fixtureId as an argument
    const beers = [
      "IPA",
      "Lager",
      "Stout",
      "Pale Ale",
      "Wheat Beer",
      "Porter",
      "Pilsner",
    ];
    const randomBeer = beers[Math.floor(Math.random() * beers.length)];
    setBeerPairing({
      fixtureId: fixtureId,
      message: `${home} vs ${away}: Enjoy it with a ${randomBeer}`
    });
    console.log('Pair Beer clicked for:', home, 'vs', away, 'fixtureId:', fixtureId);
    console.log('Beer pairing set:', `${home} vs ${away}: Enjoy it with a ${randomBeer}`);

    // start fetching nearest pub info (async fire-and-forget)
    fetchNearestPub(fixtureId, home, fixtureVenueName).catch((err) => {
      console.error('Pub lookup failed:', err);
      setPubInfo((cur) => ({ ...cur, [fixtureId]: { error: 'Failed to find pub', loading: false } }));
    });
  };

  async function fetchNearestPub(fixtureId, homeTeamName, fixtureVenueName) {
    // set loading
    setPubInfo((cur) => ({ ...cur, [fixtureId]: { loading: true } }));

    // Choose a query: prefer venue name if present, otherwise use "<team> stadium"
    const query = fixtureVenueName && fixtureVenueName.length > 2 ? fixtureVenueName : `${homeTeamName} stadium`;

    // 1) Geocode the stadium/venue using Nominatim
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const nomRes = await fetch(nomUrl);
    const nomJson = await nomRes.json();
    if (!nomJson || nomJson.length === 0) {
      // fallback: try searching just the team name
      const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(homeTeamName)}&limit=1`;
      const fbRes = await fetch(fallbackUrl);
      const fbJson = await fbRes.json();
      if (!fbJson || fbJson.length === 0) {
        throw new Error('Could not geocode stadium or team');
      }
      nomJson[0] = fbJson[0];
    }
    const lat = parseFloat(nomJson[0].lat);
    const lon = parseFloat(nomJson[0].lon);

    // 2) Query Overpass for the nearest amenity=pub within 2km
    const radius = 2000; // meters
    const overpassQuery = `
[out:json][timeout:25];
(node["amenity"="pub"](around:${radius},${lat},${lon});
 way["amenity"="pub"](around:${radius},${lat},${lon});
 relation["amenity"="pub"](around:${radius},${lat},${lon});
);
 out center 1;`;

    const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: overpassQuery,
      headers: { 'Content-Type': 'text/plain' },
    });
    const overJson = await overpassRes.json();
    if (!overJson || !overJson.elements || overJson.elements.length === 0) {
      // No pubs found nearby
      setPubInfo((cur) => ({ ...cur, [fixtureId]: { loading: false, error: 'No nearby pub found', stadium: { lat, lon } } }));
      return;
    }

    // pick the closest element by distance
    const withCoords = overJson.elements.map((el) => {
      const elLat = el.lat || (el.center && el.center.lat);
      const elLon = el.lon || (el.center && el.center.lon);
      const dx = elLat - lat;
      const dy = elLon - lon;
      const dist = dx * dx + dy * dy;
      return { el, elLat, elLon, dist };
    }).filter(x => x.elLat && x.elLon).sort((a,b)=>a.dist-b.dist);

    if (withCoords.length === 0) {
      setPubInfo((cur) => ({ ...cur, [fixtureId]: { loading: false, error: 'No geo data for pubs', stadium: { lat, lon } } }));
      return;
    }

    const chosen = withCoords[0];
    const tags = chosen.el.tags || {};
    const pubName = tags.name || 'Pub';
    // build an address from possible tags
    const parts = [];
    if (tags['addr:housenumber']) parts.push(tags['addr:housenumber']);
    if (tags['addr:street']) parts.push(tags['addr:street']);
    if (tags['addr:city']) parts.push(tags['addr:city']);
    if (tags['addr:postcode']) parts.push(tags['addr:postcode']);
    const address = parts.join(', ') || (tags['contact:address'] || tags['address'] || 'Address not available');

    const pubLat = chosen.elLat;
    const pubLon = chosen.elLon;
    const osmLink = `https://www.openstreetmap.org/?mlat=${pubLat}&mlon=${pubLon}#map=19/${pubLat}/${pubLon}`;
    const googleLink = `https://www.google.com/maps/search/?api=1&query=${pubLat},${pubLon}`;

    setPubInfo((cur) => ({
      ...cur,
      [fixtureId]: {
        loading: false,
        name: pubName,
        address,
        lat: pubLat,
        lon: pubLon,
        osmLink,
        googleLink,
      }
    }));
  }

  if (loading) return <p className="p-4">Loading fixtures…</p>;
  if (error) return <p className="p-4 text-red-500">{error}</p>;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
  <h1 style={{ textAlign: 'center' }} className="text-2xl font-bold mb-4">League Fixtures 2023</h1>

      {/* League Filter */}
      <div className="mb-6">
        <label className="mr-2 font-semibold">Choose League:</label>
        <select
          value={leagueId}
          onChange={(e) => setLeagueId(Number(e.target.value))}
          className="p-2 rounded border"
        >
          <option value={39}>Premier League</option>
          <option value={140}>La Liga</option>
          <option value={78}>Bundesliga</option>
          <option value={135}>Serie A</option>
          <option value={61}>Ligue 1</option>
        </select>
      </div>

      <div className="grid gap-4">
        {fixtures.map((item) => {
          const { fixture, teams } = item;
          return (
            <div
              key={fixture.id}
              className="bg-white rounded-2xl shadow-md p-4 flex justify-between items-center"
            >
              <div>
                <p className="font-semibold text-lg">
                  <span style={{display: 'inline-flex', alignItems: 'center'}}>
                    <img src={teams.home.logo} alt={teams.home.name} style={{height: '32px', marginRight: '8px', verticalAlign: 'middle'}} />
                    {teams.home.name}
                  </span>
                  <span style={{margin: '0 8px'}}>vs</span>
                  <span style={{display: 'inline-flex', alignItems: 'center'}}>
                    <img src={teams.away.logo} alt={teams.away.name} style={{height: '32px', marginLeft: '8px', verticalAlign: 'middle'}} />
                    {teams.away.name}
                  </span>
                </p>
                <p className="text-gray-500">
                  {new Date(fixture.date).toLocaleString()}
                </p>
              </div>
              <div className="flex flex-col items-end">
                <button
                  className="bg-yellow-500 text-white px-4 py-2 rounded-xl shadow hover:bg-yellow-600 mb-2"
                  onClick={() => suggestBeer(teams.home.name, teams.away.name, fixture.id, fixture?.venue?.name)}
                >
                  Pair Beer
                </button>
                {beerPairing.fixtureId === fixture.id && (
                  <div style={{
                    padding: '1rem',
                    border: '4px solid #eab308',
                    background: '#fef9c3',
                    borderRadius: '2rem',
                    color: '#92400e',
                    fontWeight: 'bold',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.10)'
                  }}>
                    <div style={{display:'flex', alignItems:'center', gap:'0.5rem'}}>
                      <span role="img" aria-label="beer">🍺</span>
                      <div>{beerPairing.message}</div>
                    </div>

                    {/* Pub lookup info */}
                    <div style={{marginTop: '0.75rem', fontWeight: 'normal', color: '#3f3f3f'}}>
                      {pubInfo[fixture.id] && pubInfo[fixture.id].loading && <div>Finding nearest pub…</div>}
                      {pubInfo[fixture.id] && pubInfo[fixture.id].error && <div style={{color:'#9b1c1c'}}>Pub: {pubInfo[fixture.id].error}</div>}
                      {pubInfo[fixture.id] && !pubInfo[fixture.id].loading && pubInfo[fixture.id].name && (
                        <div>
                          <div style={{fontWeight:'600'}}>{pubInfo[fixture.id].name}</div>
                          <div style={{fontSize:'0.9rem'}}>{pubInfo[fixture.id].address}</div>
                          <div style={{marginTop:'0.4rem'}}>
                            <a href={pubInfo[fixture.id].googleLink} target="_blank" rel="noreferrer" style={{marginRight:'0.5rem', color:'#0369a1'}}>Open in Google Maps</a>
                            <a href={pubInfo[fixture.id].osmLink} target="_blank" rel="noreferrer" style={{color:'#0369a1'}}>Open in OSM</a>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

  {/* Beer pairing now shown next to the relevant fixture */}
    </div>
  );
}
