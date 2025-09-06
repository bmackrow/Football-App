import React, { useState, useEffect } from "react";
import axios from "axios";

const API_BASE = "https://v3.football.api-sports.io";
const API_KEY = "e071cffd56adbe2ba8bf829368a08ce7"; // consider moving to server-side for production

export default function FixturesList() {
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [leagueId, setLeagueId] = useState(39);
  const [pubInfo, setPubInfo] = useState({});
  const [beerPairing, setBeerPairing] = useState({ fixtureId: null, message: null });
  const [animatingButton, setAnimatingButton] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function fetchFixtures() {
      setLoading(true);
      try {
        const res = await axios.get(`${API_BASE}/fixtures`, {
          params: { league: leagueId, season: 2023 },
          headers: { "x-apisports-key": API_KEY },
        });
        if (!mounted) return;
        setFixtures(res.data.response || []);
      } catch (err) {
        console.error(err);
        if (!mounted) return;
        setError("Failed to load fixtures.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchFixtures();
    return () => {
      mounted = false;
    };
  }, [leagueId]);

  const suggestBeer = (home, away, fixtureId, fixtureVenueName) => {
    const beers = ["IPA", "Lager", "Stout", "Pale Ale", "Wheat Beer", "Porter", "Pilsner"];
    const randomBeer = beers[Math.floor(Math.random() * beers.length)];
    setBeerPairing({ fixtureId, message: `${home} vs ${away}: Enjoy it with a ${randomBeer}` });

    // small button pop animation
    setAnimatingButton(fixtureId);
    setTimeout(() => setAnimatingButton((cur) => (cur === fixtureId ? null : cur)), 800);

    // fetch nearest pub (async, fire-and-forget — errors handled inside)
    fetchNearestPub(fixtureId, home, fixtureVenueName).catch((e) => {
      console.error(e);
      setPubInfo((cur) => ({ ...cur, [fixtureId]: { loading: false, error: "Lookup failed" } }));
    });

    // auto-hide pairing card after 9s
    setTimeout(() => {
      setBeerPairing((cur) => (cur.fixtureId === fixtureId ? { fixtureId: null, message: null } : cur));
    }, 9000);
  };

  async function fetchNearestPub(fixtureId, homeTeamName, fixtureVenueName) {
    setPubInfo((cur) => ({ ...cur, [fixtureId]: { loading: true } }));

    const query = fixtureVenueName && fixtureVenueName.length > 2 ? fixtureVenueName : `${homeTeamName} stadium`;
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const nomRes = await fetch(nomUrl, { headers: { "Accept": "application/json" } });
    const nomJson = await nomRes.json();

    // fallback to team name if venue not found
    if (!nomJson || nomJson.length === 0) {
      const fallbackUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(homeTeamName)}&limit=1`;
      const fbRes = await fetch(fallbackUrl, { headers: { "Accept": "application/json" } });
      const fbJson = await fbRes.json();
      if (!fbJson || fbJson.length === 0) {
        setPubInfo((cur) => ({ ...cur, [fixtureId]: { loading: false, error: "No location found" } }));
        return;
      }
      nomJson[0] = fbJson[0];
    }

    const lat = parseFloat(nomJson[0].lat);
    const lon = parseFloat(nomJson[0].lon);

    // Overpass QL to find pubs within radius (meters)
    const radius = 2000;
    const overpassQuery = `
[out:json][timeout:25];
(node["amenity"="pub"](around:${radius},${lat},${lon});
 way["amenity"="pub"](around:${radius},${lat},${lon});
 relation["amenity"="pub"](around:${radius},${lat},${lon});
);
 out center 1;`;

    const overpassRes = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: overpassQuery,
      headers: { "Content-Type": "text/plain" },
    });
    const overJson = await overpassRes.json();
    if (!overJson || !overJson.elements || overJson.elements.length === 0) {
      setPubInfo((cur) => ({ ...cur, [fixtureId]: { loading: false, error: "No nearby pub found", stadium: { lat, lon } } }));
      return;
    }

    const withCoords = overJson.elements
      .map((el) => {
        const elLat = el.lat || (el.center && el.center.lat);
        const elLon = el.lon || (el.center && el.center.lon);
        const dx = elLat - lat;
        const dy = elLon - lon;
        const dist = dx * dx + dy * dy;
        return { el, elLat, elLon, dist };
      })
      .filter((x) => x.elLat && x.elLon)
      .sort((a, b) => a.dist - b.dist);

    if (withCoords.length === 0) {
      setPubInfo((cur) => ({ ...cur, [fixtureId]: { loading: false, error: "No geo data for pubs", stadium: { lat, lon } } }));
      return;
    }

    const chosen = withCoords[0];
    const tags = chosen.el.tags || {};
    const pubName = tags.name || "Pub";
    const parts = [];
    if (tags["addr:housenumber"]) parts.push(tags["addr:housenumber"]);
    if (tags["addr:street"]) parts.push(tags["addr:street"]);
    if (tags["addr:city"]) parts.push(tags["addr:city"]);
    if (tags["addr:postcode"]) parts.push(tags["addr:postcode"]);
    const address = parts.join(", ") || (tags["contact:address"] || tags["address"] || "Address not available");

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
      },
    }));
  }

  if (loading) return <p className="p-4">Loading fixtures…</p>;
  if (error) return <p className="p-4 text-red-500">{error}</p>;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <style>{`
        .btn-pop { animation: pop 420ms cubic-bezier(.2,.9,.2,1); }
        @keyframes pop { 0% { transform: scale(1) rotate(0deg); } 40% { transform: scale(1.12) rotate(-6deg); } 70% { transform: scale(0.98) rotate(3deg); } 100% { transform: scale(1) rotate(0deg); } }
        .pairing-card { opacity: 0; transform: translateY(-8px) scale(0.995); transition: opacity 280ms ease, transform 280ms ease; }
        .pairing-card.show { opacity: 1; transform: translateY(0) scale(1); }
        .beer-emoji { display: inline-block; transform-origin: 50% 50%; }
        .beer-emoji.bounce { animation: hop 900ms ease; }
        @keyframes hop { 0% { transform: translateY(0) rotate(0deg); } 30% { transform: translateY(-8px) rotate(-12deg); } 60% { transform: translateY(0) rotate(8deg); } 100% { transform: translateY(0) rotate(0deg); } }
      `}</style>

      <h1 style={{ textAlign: "center" }} className="text-2xl font-bold mb-4">League Fixtures 2023</h1>

      <div className="mb-6">
        <label className="mr-2 font-semibold">Choose League:</label>
        <select value={leagueId} onChange={(e) => setLeagueId(Number(e.target.value))} className="p-2 rounded border">
          <option value={39}>Premier League</option>
          <option value={140}>La Liga</option>
          <option value={78}>Bundesliga</option>
          <option value={135}>Serie A</option>
          <option value={61}>Ligue 1</option>
        </select>
      </div>

      <div className="grid gap-4">
        {fixtures.map((item) => {
          const fixture = item.fixture || {};
          const teams = item.teams || {};
          return (
            <div key={fixture.id} className="bg-white rounded-2xl shadow-md p-4 flex justify-between items-center">
              <div>
                <p className="font-semibold text-lg">
                  <span style={{ display: "inline-flex", alignItems: "center" }}>
                    {teams.home?.logo && <img src={teams.home.logo} alt={teams.home?.name} style={{ height: 32, marginRight: 8 }} />}
                    {teams.home?.name}
                  </span>
                  <span style={{ margin: "0 8px" }}>vs</span>
                  <span style={{ display: "inline-flex", alignItems: "center" }}>
                    {teams.away?.logo && <img src={teams.away.logo} alt={teams.away?.name} style={{ height: 32, marginLeft: 8 }} />}
                    {teams.away?.name}
                  </span>
                </p>
                <p className="text-gray-500">{fixture.date ? new Date(fixture.date).toLocaleString() : "TBD"}</p>
              </div>
              <div className="flex flex-col items-end">
                <button
                  className={"bg-yellow-500 text-white px-4 py-2 rounded-xl shadow hover:bg-yellow-600 mb-2 " + (animatingButton === fixture.id ? "btn-pop" : "")}
                  onClick={() => suggestBeer(teams.home?.name || "Home", teams.away?.name || "Away", fixture.id, fixture?.venue?.name)}
                >
                  Pair Beer
                </button>

                {beerPairing.fixtureId === fixture.id && (
                  <div className={"pairing-card show"} style={{ padding: "1rem", border: "4px solid #eab308", background: "#fef9c3", borderRadius: "2rem", color: "#92400e", fontWeight: "bold", boxShadow: "0 2px 8px rgba(0,0,0,0.10)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span role="img" aria-label="beer" className={"beer-emoji " + (animatingButton === fixture.id ? "bounce" : "")}>🍺</span>
                      <div>{beerPairing.message}</div>
                    </div>

                    <div style={{ marginTop: "0.75rem", fontWeight: "normal", color: "#3f3f3f" }}>
                      {pubInfo[fixture.id] && pubInfo[fixture.id].loading && <div>Finding nearest pub…</div>}
                      {pubInfo[fixture.id] && pubInfo[fixture.id].error && <div style={{ color: "#9b1c1c" }}>Pub: {pubInfo[fixture.id].error}</div>}
                      {pubInfo[fixture.id] && !pubInfo[fixture.id].loading && pubInfo[fixture.id].name && (
                        <div>
                          <div style={{ fontWeight: "600" }}>{pubInfo[fixture.id].name}</div>
                          <div style={{ fontSize: "0.9rem" }}>{pubInfo[fixture.id].address}</div>
                          <div style={{ marginTop: "0.4rem" }}>
                            <a href={pubInfo[fixture.id].googleLink} target="_blank" rel="noreferrer" style={{ marginRight: "0.5rem", color: "#0369a1" }}>
                              Open in Google Maps
                            </a>
                            <a href={pubInfo[fixture.id].osmLink} target="_blank" rel="noreferrer" style={{ color: "#0369a1" }}>
                              Open in OSM
                            </a>
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
    </div>
  );
}
