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

  const suggestBeer = (home, away, fixtureId) => {
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
  };

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
                  onClick={() => suggestBeer(teams.home.name, teams.away.name, fixture.id)}
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
                    <span role="img" aria-label="beer">🍺</span> {beerPairing.message}
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
