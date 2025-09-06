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
  // Track which fixture's button is animating (transient)
  const [animatingButton, setAnimatingButton] = useState(null);

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
    // trigger a quick button animation for the clicked fixture
    setAnimatingButton(fixtureId);
    // clear animation flag after the animation finishes
    setTimeout(() => setAnimatingButton((cur) => (cur === fixtureId ? null : cur)), 800);
    // optionally auto-hide the pairing message after 6s
    setTimeout(() => {
      setBeerPairing((cur) => (cur.fixtureId === fixtureId ? { fixtureId: null, message: null } : cur));
    }, 6000);
    console.log('Pair Beer clicked for:', home, 'vs', away, 'fixtureId:', fixtureId);
    console.log('Beer pairing set:', `${home} vs ${away}: Enjoy it with a ${randomBeer}`);
  };

  if (loading) return <p className="p-4">Loading fixtures…</p>;
  if (error) return <p className="p-4 text-red-500">{error}</p>;

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Inline component styles for animations */}
      <style>{`
        .btn-pop {
          animation: pop 420ms cubic-bezier(.2,.9,.2,1);
        }
        @keyframes pop {
          0% { transform: scale(1) rotate(0deg); }
          40% { transform: scale(1.12) rotate(-6deg); }
          70% { transform: scale(0.98) rotate(3deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        .pairing-card {
          opacity: 0;
          transform: translateY(-8px) scale(0.995);
          transition: opacity 280ms ease, transform 280ms ease;
        }
        .pairing-card.show {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
        .beer-emoji { display: inline-block; transform-origin: 50% 50%; }
        .beer-emoji.bounce {
          animation: hop 900ms ease;
        }
        @keyframes hop {
          0% { transform: translateY(0) rotate(0deg); }
          30% { transform: translateY(-8px) rotate(-12deg); }
          60% { transform: translateY(0) rotate(8deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
      `}</style>
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
                  className={"bg-yellow-500 text-white px-4 py-2 rounded-xl shadow hover:bg-yellow-600 mb-2 " + (animatingButton === fixture.id ? 'btn-pop' : '')}
                  onClick={() => suggestBeer(teams.home.name, teams.away.name, fixture.id)}
                >
                  Pair Beer
                </button>
                {beerPairing.fixtureId === fixture.id && (
                  <div className={"pairing-card show"} style={{
                    padding: '1rem',
                    border: '4px solid #eab308',
                    background: '#fef9c3',
                    borderRadius: '2rem',
                    color: '#92400e',
                    fontWeight: 'bold',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.10)'
                  }}>
                    <span role="img" aria-label="beer" className={"beer-emoji " + (animatingButton === fixture.id ? 'bounce' : '')}>🍺</span>
                    <span style={{marginLeft: '0.5rem'}}>{beerPairing.message}</span>
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
