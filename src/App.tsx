import { useState, useCallback } from "react";

const ANIMALS = [
  { n: "Duck", e: "🦆" },
  { n: "Chicken", e: "🐔" },
  { n: "Horse", e: "🐴" },
  { n: "Pig", e: "🐷" },
  { n: "Cow", e: "🐮" },
  { n: "Rabbit", e: "🐰" },
];

const PLAYER_COLORS = ["#5B4FD4", "#D84F2A", "#1A9E5A", "#C03A7A"];
const PLAYER_BG = ["#EEEDFE", "#FAECE7", "#E1F5EE", "#FBEAF0"];
const PLAYER_BORDER = ["#7F77DD", "#F0997B", "#5DCAA5", "#D4537E"];
const MEADOW = 0;
const FARMHOUSE = 37;
const TILE_X = [100, 166, 232, 298, 364, 430, 496, 562, 628];
const ROW_Y = [8, 73, 138, 203]; // tightened row spacing (gap halved)

function getTileCoord(pos) {
  const idx = pos - 1;
  const row = Math.floor(idx / 9);
  const col = idx % 9;
  const x = row % 2 === 0 ? TILE_X[col] : TILE_X[8 - col];
  return { x, y: ROW_Y[row], cx: x + 26, cy: ROW_Y[row] + 26 };
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildPath() {
  const tiles = [];
  for (let g = 0; g < 6; g++) tiles.push(...shuffle([0, 1, 2, 3, 4, 5]));
  return tiles;
}

function buildDeck() {
  const d = [];
  for (let a = 0; a < 6; a++) for (let i = 0; i < 16; i++) d.push(a);
  return shuffle(d);
}

function dealHands(deck, numPlayers, handSize = 6) {
  const hands = Array.from({ length: numPlayers }, () => []);
  let di = 0;
  for (let c = 0; c < handSize; c++)
    for (let p = 0; p < numPlayers; p++)
      if (di < deck.length) hands[p].push(deck[di++]);
  return { hands, remaining: deck.slice(di) };
}

function countAt(farmers, pos) {
  let n = 0;
  farmers.forEach((pf) =>
    pf.forEach((f) => {
      if (f === pos) n++;
    })
  );
  return n;
}

function findNextTile(path, farmers, fromPos, animalIdx) {
  for (let p = fromPos + 1; p <= 36; p++) {
    if (path[p - 1] === animalIdx && countAt(farmers, p) === 0) return p;
  }
  return FARMHOUSE;
}

function findRetreatTarget(farmers, fromPos) {
  for (let p = fromPos - 1; p >= 1; p--) {
    const n = countAt(farmers, p);
    if (n > 0 && n < 3) return p;
  }
  return MEADOW;
}

function addLog(logs, msg) {
  return [msg, ...logs].slice(0, 20);
}

function initGame(names) {
  const path = buildPath();
  const deck = buildDeck();
  const { hands, remaining } = dealHands(deck, names.length);
  const farmers = names.map(() => new Array(6).fill(MEADOW));
  return {
    names,
    path,
    deck: remaining,
    discard: [],
    hands,
    farmers,
    cur: 0,
    actLeft: 3,
    phase: "idle",
    selCard: -1,
    selFarmer: -1,
    logs: [],
    winner: -1,
  };
}

function drawCards(G, pi, count) {
  let { deck, discard, hands } = G;
  hands = hands.map((h, i) => (i === pi ? [...h] : h));
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    if (hands[pi].length >= 8) break;
    if (deck.length === 0) {
      if (discard.length === 0) break;
      deck = shuffle(discard);
      discard = [];
    }
    hands[pi].push(deck[deck.length - 1]);
    deck = deck.slice(0, -1);
    drawn++;
  }
  return { ...G, deck, discard, hands, _drawnCount: drawn };
}

// ── Root ───────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("setup");
  const [numP, setNumP] = useState(0);
  const [names, setNames] = useState([
    "Player 1",
    "Player 2",
    "Player 3",
    "Player 4",
  ]);
  const [G, setG] = useState(null);
  const [cardsShown, setCardsShown] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const startGame = () => {
    setG(initGame(names.slice(0, numP)));
    setCardsShown(false);
    setScreen("reveal");
  };

  const beginTurn = () => {
    setG((g) => ({
      ...g,
      actLeft: 3,
      phase: "idle",
      selCard: -1,
      selFarmer: -1,
    }));
    setCardsShown(false);
    setScreen("game");
  };

  const endTurn = useCallback(() => {
    setG((g) => ({
      ...g,
      cur: (g.cur + 1) % g.names.length,
      actLeft: 3,
      phase: "idle",
      selCard: -1,
      selFarmer: -1,
    }));
    setCardsShown(false);
    setScreen("reveal");
  }, []);

  const cancelAct = () =>
    setG((g) => ({ ...g, phase: "idle", selCard: -1, selFarmer: -1 }));

  const onSelectCard = (ci) => {
    setG((g) => {
      if (g.actLeft <= 0) return g;
      if (g.phase === "card_sel" && g.selCard === ci)
        return { ...g, phase: "idle", selCard: -1 };
      return { ...g, phase: "card_sel", selCard: ci, selFarmer: -1 };
    });
  };

  const onClickFarmer = useCallback((fi) => {
    setG((g) => {
      const pos = g.farmers[g.cur][fi];
      if (pos === FARMHOUSE) return g;

      if (g.phase === "card_sel") {
        if (g.selCard < 0) return g;
        const animal = g.hands[g.cur][g.selCard];
        const toPos = findNextTile(g.path, g.farmers, pos, animal);

        const farmers = g.farmers.map((pf, pi) =>
          pi === g.cur ? pf.map((f, i) => (i === fi ? toPos : f)) : pf
        );
        const hands = g.hands.map((h, pi) =>
          pi === g.cur ? h.filter((_, i) => i !== g.selCard) : h
        );
        const discard = [...g.discard, animal];
        let ns = {
          ...g,
          farmers,
          hands,
          discard,
          actLeft: g.actLeft - 1,
          phase: "idle",
          selCard: -1,
        };
        const label =
          toPos === FARMHOUSE
            ? "🏠 Farmhouse"
            : `${ANIMALS[g.path[toPos - 1]].e} ${
                ANIMALS[g.path[toPos - 1]].n
              } (${toPos})`;
        ns.logs = addLog(ns.logs, `${g.names[g.cur]} moved farmer → ${label}`);
        if (ns.farmers[g.cur].every((f) => f === FARMHOUSE)) {
          ns.winner = g.cur;
          return ns;
        }
        if (ns.actLeft <= 0) ns._endTurn = true;
        return ns;
      } else {
        if (pos === MEADOW)
          return {
            ...g,
            logs: addLog(g.logs, "Cannot retreat from the meadow."),
          };
        if (g.phase === "retreat_sel" && g.selFarmer === fi)
          return { ...g, phase: "idle", selFarmer: -1 };
        return { ...g, phase: "retreat_sel", selFarmer: fi };
      }
    });
  }, []);

  const onConfirmRetreat = () => {
    setG((g) => {
      const fi = g.selFarmer;
      if (fi < 0) return g;
      const from = g.farmers[g.cur][fi];
      const toPos = findRetreatTarget(g.farmers, from);

      const baseCount = toPos === MEADOW ? 2 : countAt(g.farmers, toPos);

      const farmers = g.farmers.map((pf, pi) =>
        pi === g.cur ? pf.map((f, i) => (i === fi ? toPos : f)) : pf
      );
      let ns = {
        ...g,
        farmers,
        actLeft: g.actLeft - 1,
        phase: "idle",
        selFarmer: -1,
      };
      const result = drawCards(ns, g.cur, baseCount);
      ns = result;
      const dest =
        toPos === MEADOW
          ? "🌿 Meadow"
          : `${ANIMALS[g.path[toPos - 1]].e} ${ANIMALS[g.path[toPos - 1]].n}`;
      ns.logs = addLog(
        ns.logs,
        `${g.names[g.cur]} retreated to ${dest}, drew ${
          result._drawnCount
        } card${result._drawnCount !== 1 ? "s" : ""}`
      );
      if (ns.actLeft <= 0) ns._endTurn = true;
      return ns;
    });
  };

  if (G?._endTurn && !G?.winner) {
    const next = (G.cur + 1) % G.names.length;
    setG({
      ...G,
      _endTurn: false,
      cur: next,
      actLeft: 3,
      phase: "idle",
      selCard: -1,
      selFarmer: -1,
    });
    setCardsShown(false);
    setScreen("reveal");
  }
  if (G?.winner >= 0 && screen === "game") setScreen("win");

  if (screen === "setup")
    return (
      <>
        <Setup
          numP={numP}
          setNumP={setNumP}
          names={names}
          setNames={setNames}
          onStart={startGame}
          onShowHelp={() => setShowHelp(true)}
        />
        {showHelp && <HowToPlay onClose={() => setShowHelp(false)} />}
      </>
    );
  if (screen === "reveal")
    return (
      <Reveal
        G={G}
        shown={cardsShown}
        onReveal={() => setCardsShown(true)}
        onBegin={beginTurn}
      />
    );
  if (screen === "game")
    return (
      <>
        <Game
          G={G}
          onSelectCard={onSelectCard}
          onClickFarmer={onClickFarmer}
          onConfirmRetreat={onConfirmRetreat}
          onCancel={cancelAct}
          onEndTurn={endTurn}
          onShowHelp={() => setShowHelp(true)}
        />
        {showHelp && <HowToPlay onClose={() => setShowHelp(false)} />}
      </>
    );
  if (screen === "win")
    return (
      <Win
        G={G}
        onReset={() => {
          setG(null);
          setScreen("setup");
        }}
      />
    );
  return null;
}

// ── How to Play modal ────────────────────────────────────────────────────────
function HowToPlay({ onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "1rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--color-background-primary)",
          borderRadius: 14,
          maxWidth: 480,
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
          padding: "1.4rem 1.4rem 1.2rem",
          position: "relative",
          boxShadow: "0 8px 30px rgba(0,0,0,0.2)",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            background: "var(--color-background-secondary)",
            border: "none",
            borderRadius: "50%",
            width: 28,
            height: 28,
            cursor: "pointer",
            fontSize: 14,
            lineHeight: 1,
            color: "var(--color-text-secondary)",
          }}
        >
          ✕
        </button>

        <div style={{ fontSize: 19, fontWeight: 600, marginBottom: 12 }}>
          🌾 Farm Chase — How to Play
        </div>

        <div
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            color: "var(--color-text-primary)",
          }}
        >
          <p style={{ margin: "0 0 10px" }}>
            <b>Goal:</b> Be the first to get all 6 of your farmers from the
            Meadow 🌿 to the Farmhouse 🏠!
          </p>
          <p style={{ margin: "0 0 10px" }}>
            <b>Setup:</b> Each player gets 6 cards. Each card shows a farm
            animal — Duck 🦆, Chicken 🐔, Horse 🐴, Pig 🐷, Cow 🐮, or Rabbit
            🐰.
          </p>
          <p style={{ margin: "0 0 4px" }}>
            <b>Your turn — 3 actions.</b> For each action, choose ONE:
          </p>
          <ol style={{ margin: "0 0 10px", paddingLeft: 20 }}>
            <li style={{ marginBottom: 6 }}>
              <b>Move forward</b> — Play a card and pick one of your farmers.
              That farmer hops forward to the next <i>empty</i> tile showing
              that animal. The card is used up.
            </li>
            <li>
              <b>Retreat</b> — Pick one of your farmers (not from the Meadow)
              and send it back to the nearest tile with 1 or 2 farmers already
              on it. Draw new cards — one for each farmer that was already
              there! Retreating all the way to the Meadow always gives 2 cards.
            </li>
          </ol>
          <p style={{ margin: "0 0 10px" }}>
            You can mix and match — move forward twice and retreat once, or use
            all 3 actions to move forward, etc.
          </p>
          <p style={{ margin: "0 0 4px" }}>
            <b>Remember:</b>
          </p>
          <ul style={{ margin: "0 0 10px", paddingLeft: 20 }}>
            <li>
              A tile can never hold more than <b>3 farmers</b>.
            </li>
            <li>
              You can hold up to <b>8 cards</b> in your hand at a time.
            </li>
            <li>No good moves left? Click "End Turn" early.</li>
          </ul>
          <p style={{ margin: 0 }}>
            <b>Winning:</b> The first player to get all 6 farmers safely into
            the Farmhouse wins! 🏆
          </p>
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 16,
            width: "100%",
            background: PLAYER_COLORS[0],
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "9px 0",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Got it!
        </button>
      </div>
    </div>
  );
}

// ── Setup ──────────────────────────────────────────────────────────────────
function Setup({ numP, setNumP, names, setNames, onStart, onShowHelp }) {
  return (
    <div
      style={{
        maxWidth: 360,
        margin: "2rem auto",
        padding: "0 1rem",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 8 }}>🌾</div>
      <div style={{ fontSize: 22, fontWeight: 500, marginBottom: 4 }}>
        Farm Chase
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--color-text-secondary)",
          marginBottom: 28,
        }}
      >
        Race all your farmers from the meadow to the farmhouse!
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 10 }}>
        Number of players
      </div>
      <div
        style={{
          display: "flex",
          gap: 10,
          justifyContent: "center",
          marginBottom: 24,
        }}
      >
        {[2, 3, 4].map((n) => (
          <button
            key={n}
            onClick={() => setNumP(n)}
            style={{
              width: 58,
              height: 58,
              fontSize: 20,
              fontWeight: 500,
              borderRadius: 12,
              cursor: "pointer",
              background:
                numP === n
                  ? PLAYER_COLORS[0]
                  : "var(--color-background-primary)",
              color: numP === n ? "#fff" : "var(--color-text-primary)",
              border:
                numP === n
                  ? `2px solid ${PLAYER_COLORS[0]}`
                  : "0.5px solid var(--color-border-secondary)",
              transition: "all 0.15s",
            }}
          >
            {n}
          </button>
        ))}
      </div>
      {numP > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 24,
            textAlign: "left",
          }}
        >
          {Array.from({ length: numP }, (_, i) => (
            <div key={i}>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--color-text-secondary)",
                  display: "block",
                  marginBottom: 3,
                }}
              >
                Player {i + 1}
              </label>
              <input
                value={names[i]}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNames((ns: string[]) =>
                    ns.map((n: string, j: number) =>
                      j === i ? e.target.value : n
                    )
                  )
                }
                style={{
                  width: "100%",
                  padding: "7px 10px",
                  fontSize: 13,
                  borderRadius: 8,
                  border: "0.5px solid var(--color-border-secondary)",
                  borderLeft: `3px solid ${PLAYER_COLORS[i]}`,
                  background: "var(--color-background-primary)",
                  color: "var(--color-text-primary)",
                }}
              />
            </div>
          ))}
        </div>
      )}
      <button
        onClick={onStart}
        disabled={numP === 0}
        style={{
          background:
            numP === 0 ? "var(--color-background-secondary)" : PLAYER_COLORS[0],
          color: numP === 0 ? "var(--color-text-secondary)" : "#fff",
          border: "none",
          borderRadius: 8,
          padding: "10px 32px",
          fontSize: 14,
          cursor: numP === 0 ? "not-allowed" : "pointer",
          fontWeight: 500,
        }}
      >
        Start Game
      </button>

      <div style={{ marginTop: 16 }}>
        <button
          onClick={onShowHelp}
          style={{
            background: "none",
            border: "none",
            color: "var(--color-text-secondary)",
            fontSize: 12,
            textDecoration: "underline",
            cursor: "pointer",
            fontWeight: 400,
            padding: 0,
          }}
        >
          How to Play
        </button>
      </div>
    </div>
  );
}

// ── Reveal ─────────────────────────────────────────────────────────────────
function Reveal({ G, shown, onReveal, onBegin }) {
  if (!G) return null;
  const col = PLAYER_COLORS[G.cur];
  return (
    <div
      style={{
        maxWidth: 400,
        margin: "2rem auto",
        padding: "0 1rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 13,
          color: "var(--color-text-secondary)",
          marginBottom: 4,
        }}
      >
        Up next:
      </div>
      <div
        style={{ fontSize: 22, fontWeight: 500, color: col, marginBottom: 4 }}
      >
        {G.names[G.cur]}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--color-text-secondary)",
          marginBottom: 24,
        }}
      >
        Pass the device, then tap to see your hand.
      </div>
      {!shown ? (
        <button
          onClick={onReveal}
          style={{
            background: col,
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "10px 28px",
            fontSize: 14,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Reveal my cards
        </button>
      ) : (
        <>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            {G.hands[G.cur].map((a, i) => (
              <CardFace key={i} animal={a} />
            ))}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--color-text-secondary)",
              marginBottom: 16,
            }}
          >
            {G.hands[G.cur].length} cards · 3 actions this turn
          </div>
          <button
            onClick={onBegin}
            style={{
              background: "#0F6E56",
              color: "#E1F5EE",
              border: "none",
              borderRadius: 8,
              padding: "10px 28px",
              fontSize: 14,
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Start my turn →
          </button>
        </>
      )}
    </div>
  );
}

// ── Win ────────────────────────────────────────────────────────────────────
function Win({ G, onReset }) {
  if (!G) return null;
  return (
    <div
      style={{
        maxWidth: 360,
        margin: "3rem auto",
        padding: "0 1rem",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 56, marginBottom: 12 }}>🏆</div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 500,
          color: PLAYER_COLORS[G.winner],
          marginBottom: 6,
        }}
      >
        {G.names[G.winner]} wins!
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--color-text-secondary)",
          marginBottom: 28,
        }}
      >
        All 6 farmers made it safely to the farmhouse!
      </div>
      <button
        onClick={onReset}
        style={{
          background: PLAYER_COLORS[0],
          color: "#fff",
          border: "none",
          borderRadius: 8,
          padding: "10px 28px",
          fontSize: 14,
          cursor: "pointer",
          fontWeight: 500,
        }}
      >
        Play again
      </button>
    </div>
  );
}

// ── Card face ──────────────────────────────────────────────────────────────
function CardFace({ animal, selected, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 52,
        height: 68,
        borderRadius: 8,
        cursor: onClick ? "pointer" : "default",
        border: selected
          ? "2px solid #378ADD"
          : "0.5px solid var(--color-border-secondary)",
        background: selected ? "#E6F1FB" : "var(--color-background-primary)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        transform: selected ? "translateY(-6px)" : "none",
        transition: "transform 0.12s, border 0.12s, background 0.12s",
        userSelect: "none",
      }}
    >
      <span style={{ fontSize: 20 }}>{ANIMALS[animal].e}</span>
      <span style={{ fontSize: 9, color: "var(--color-text-secondary)" }}>
        {ANIMALS[animal].n}
      </span>
    </div>
  );
}

// ── Game screen ────────────────────────────────────────────────────────────
function Game({
  G,
  onSelectCard,
  onClickFarmer,
  onConfirmRetreat,
  onCancel,
  onEndTurn,
  onShowHelp,
}) {
  if (!G) return null;
  const cur = G.cur;
  const col = PLAYER_COLORS[cur];
  const hintText =
    {
      idle: "Play a card to advance a farmer, or tap a farmer on the board to retreat.",
      card_sel:
        G.selCard >= 0
          ? `Tap one of your highlighted farmers to move to the next free ${
              ANIMALS[G.hands[cur][G.selCard]]?.n
            } tile.`
          : "",
      retreat_sel:
        "Farmer selected — tap Confirm retreat to move it back and draw cards.",
    }[G.phase] || "";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "0.6rem 0.75rem",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 8,
          paddingBottom: 8,
          borderBottom: "0.5px solid var(--color-border-tertiary)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: col,
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: 15, fontWeight: 500, color: col }}>
            {G.names[cur]}
          </span>
          <span
            style={{
              fontSize: 12,
              color: "var(--color-text-secondary)",
              background: "var(--color-background-secondary)",
              borderRadius: 20,
              padding: "2px 10px",
            }}
          >
            {G.actLeft} action{G.actLeft !== 1 ? "s" : ""} left
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={onShowHelp}
            style={{
              background: "var(--color-background-primary)",
              border: "0.5px solid var(--color-border-secondary)",
              borderRadius: 8,
              padding: "5px 12px",
              fontSize: 12,
              cursor: "pointer",
              color: "var(--color-text-primary)",
            }}
          >
            How to Play
          </button>
          {G.phase !== "idle" && (
            <button
              onClick={onCancel}
              style={{
                background: "var(--color-background-primary)",
                border: "0.5px solid var(--color-border-secondary)",
                borderRadius: 8,
                padding: "5px 12px",
                fontSize: 12,
                cursor: "pointer",
                color: "var(--color-text-primary)",
              }}
            >
              Cancel
            </button>
          )}
          {G.phase === "retreat_sel" && G.selFarmer >= 0 && (
            <button
              onClick={onConfirmRetreat}
              style={{
                background: "#993C1D",
                color: "#FAECE7",
                border: "none",
                borderRadius: 8,
                padding: "5px 14px",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Confirm retreat
            </button>
          )}
          <button
            onClick={onEndTurn}
            style={{
              background: "#854F0B",
              color: "#FAEEDA",
              border: "none",
              borderRadius: 8,
              padding: "5px 14px",
              fontSize: 12,
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            End turn
          </button>
        </div>
      </div>

      {/* Board */}
      <div style={{ overflowX: "auto" }}>
        <Board G={G} onClickFarmer={onClickFarmer} />
      </div>

      {/* Hand */}
      <div
        style={{
          background: "var(--color-background-primary)",
          border: "0.5px solid var(--color-border-tertiary)",
          borderRadius: 12,
          padding: "0.7rem 0.9rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 500 }}>Your hand</span>
          <span style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
            {G.hands[cur].length}/8
          </span>
        </div>
        <div
          style={{
            fontSize: 11,
            color: "var(--color-text-secondary)",
            fontStyle: "italic",
            marginBottom: 8,
            minHeight: 16,
          }}
        >
          {hintText}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
          {G.hands[cur].map((a, i) => (
            <CardFace
              key={i}
              animal={a}
              selected={G.phase === "card_sel" && G.selCard === i}
              onClick={() => onSelectCard(i)}
            />
          ))}
          {G.hands[cur].length === 0 && (
            <div
              style={{
                fontSize: 12,
                color: "var(--color-text-secondary)",
                fontStyle: "italic",
              }}
            >
              No cards — retreat a farmer to draw more.
            </div>
          )}
        </div>
      </div>

      {/* Log */}
      {G.logs.length > 0 && (
        <div
          style={{
            fontSize: 11,
            color: "var(--color-text-secondary)",
            background: "var(--color-background-secondary)",
            borderRadius: 8,
            padding: "5px 10px",
            maxHeight: 54,
            overflowY: "auto",
          }}
        >
          {G.logs.map((l, i) => (
            <div key={i} style={{ marginBottom: 1 }}>
              {l}
            </div>
          ))}
        </div>
      )}

      {/* Progress */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {G.names.map((nm, pi) => {
          const done = G.farmers[pi].filter((f) => f === FARMHOUSE).length;
          return (
            <div
              key={pi}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                background:
                  pi === cur
                    ? PLAYER_BG[pi]
                    : "var(--color-background-secondary)",
                border: `0.5px solid ${
                  pi === cur
                    ? PLAYER_BORDER[pi]
                    : "var(--color-border-tertiary)"
                }`,
                borderRadius: 20,
                padding: "3px 10px",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: PLAYER_COLORS[pi],
                  display: "inline-block",
                }}
              />
              <span style={{ color: "var(--color-text-primary)" }}>{nm}</span>
              <span style={{ color: PLAYER_COLORS[pi], fontWeight: 500 }}>
                {done}/6 🏠
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Board SVG ──────────────────────────────────────────────────────────────
function Board({ G, onClickFarmer }) {
  const { path, farmers, hands, cur, phase, selCard, selFarmer } = G;
  const selAnimal =
    phase === "card_sel" && selCard >= 0 ? hands[cur][selCard] : -1;

  const farmerMap = {};
  farmers.forEach((pf, pi) => {
    pf.forEach((pos, fi) => {
      if (!farmerMap[pos]) farmerMap[pos] = [];
      farmerMap[pos].push({ pi, fi });
    });
  });

  function BigZoneSummary({ pos, cx, topY, zoneH }) {
    const fs = farmerMap[pos] || [];
    if (!fs.length) return null;
    const byPlayer = {};
    fs.forEach(({ pi, fi }) => {
      if (!byPlayer[pi]) byPlayer[pi] = [];
      byPlayer[pi].push(fi);
    });
    const entries = Object.entries(byPlayer);
    const total = entries.length;
    const spacing = 18;
    const startX = cx - ((total - 1) * spacing) / 2;
    const tokenY = topY + zoneH * 0.62;

    return entries.map(([piStr, fis], idx) => {
      const pi = parseInt(piStr);
      const count = fis.length;
      const tx = startX + idx * spacing;
      const isHighlighted =
        phase === "card_sel" && pi === cur && pos !== FARMHOUSE;
      const isRetSel =
        phase === "retreat_sel" && pi === cur && fis.includes(selFarmer);
      const isClickable =
        isHighlighted ||
        (phase === "idle" &&
          pi === cur &&
          pos !== MEADOW &&
          pos !== FARMHOUSE) ||
        (phase === "retreat_sel" &&
          pi === cur &&
          pos !== MEADOW &&
          pos !== FARMHOUSE);
      const clickFi = fis[0];

      return (
        <g
          key={pi}
          onClick={isClickable ? () => onClickFarmer(clickFi) : undefined}
          style={{ cursor: isClickable ? "pointer" : "default" }}
        >
          {isHighlighted && (
            <circle
              cx={tx}
              cy={tokenY}
              r={12}
              fill="none"
              stroke="#FFD700"
              strokeWidth={2}
              opacity={0.8}
            />
          )}
          {isRetSel && (
            <circle
              cx={tx}
              cy={tokenY}
              r={12}
              fill="none"
              stroke="#FF8C00"
              strokeWidth={2}
              opacity={0.9}
            />
          )}
          <circle
            cx={tx}
            cy={tokenY}
            r={9}
            fill={PLAYER_COLORS[pi]}
            stroke="white"
            strokeWidth={1.5}
          />
          <text
            x={tx}
            y={tokenY}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={9}
            fontWeight="600"
            fill="white"
            style={{ pointerEvents: "none" }}
          >
            {G.names[pi][0].toUpperCase()}
          </text>
          {count > 1 && (
            <>
              <rect
                x={tx + 4}
                y={tokenY - 14}
                width={16}
                height={11}
                rx={5}
                fill={PLAYER_COLORS[pi]}
                stroke="white"
                strokeWidth={1}
              />
              <text
                x={tx + 12}
                y={tokenY - 9}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={8}
                fontWeight="700"
                fill="white"
                style={{ pointerEvents: "none" }}
              >
                ×{count}
              </text>
            </>
          )}
        </g>
      );
    });
  }

  function TileTokens({ pos, tileX, tileY }) {
    const fs = farmerMap[pos] || [];
    if (!fs.length) return null;
    const r = 5;
    const spacing = 12;
    const total = fs.length;
    const startX = tileX + 26 - ((total - 1) * spacing) / 2;
    const ty = tileY + 31;

    return fs.map(({ pi, fi }, idx) => {
      const tx = startX + idx * spacing;
      const isHighlighted =
        phase === "card_sel" && pi === cur && pos !== FARMHOUSE;
      const isRetSel =
        phase === "retreat_sel" && pi === cur && fi === selFarmer;
      const isClickable =
        isHighlighted ||
        (phase === "idle" &&
          pi === cur &&
          pos !== MEADOW &&
          pos !== FARMHOUSE) ||
        (phase === "retreat_sel" &&
          pi === cur &&
          pos !== MEADOW &&
          pos !== FARMHOUSE);

      return (
        <g
          key={`${pi}-${fi}`}
          onClick={isClickable ? () => onClickFarmer(fi) : undefined}
          style={{ cursor: isClickable ? "pointer" : "default" }}
        >
          {isHighlighted && (
            <circle
              cx={tx}
              cy={ty}
              r={r + 3}
              fill="none"
              stroke="#FFD700"
              strokeWidth={1.5}
              opacity={0.85}
            />
          )}
          {isRetSel && (
            <circle
              cx={tx}
              cy={ty}
              r={r + 3}
              fill="none"
              stroke="#FF8C00"
              strokeWidth={1.5}
              opacity={0.9}
            />
          )}
          <circle
            cx={tx}
            cy={ty}
            r={r}
            fill={PLAYER_COLORS[pi]}
            stroke="white"
            strokeWidth={1}
          />
          <text
            x={tx}
            y={ty}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={5.5}
            fontWeight="700"
            fill="white"
            style={{ pointerEvents: "none" }}
          >
            {G.names[pi][0].toUpperCase()}
          </text>
        </g>
      );
    });
  }

  return (
    <svg
      width="100%"
      viewBox="0 0 680 264"
      style={{ display: "block", minWidth: 620 }}
    >
      <defs>
        <marker
          id="arr"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path
            d="M2 1L8 5L2 9"
            fill="none"
            stroke="context-stroke"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </marker>
      </defs>

      {/* Meadow */}
      <rect
        x={8}
        y={8}
        width={80}
        height={52}
        rx={8}
        fill="#EAF3DE"
        stroke="#3B6D11"
        strokeWidth={1.5}
      />
      <text x={48} y={24} textAnchor="middle" fontSize={16}>
        🌿
      </text>
      <text
        x={48}
        y={50}
        textAnchor="middle"
        fontSize={10}
        fill="#3B6D11"
        fontWeight="500"
      >
        Meadow
      </text>
      <BigZoneSummary pos={MEADOW} cx={48} topY={8} zoneH={52} />
      <line
        x1={89}
        y1={34}
        x2={98}
        y2={34}
        stroke="#888780"
        strokeWidth={1.5}
        markerEnd="url(#arr)"
      />

      {/* Tiles */}
      {Array.from({ length: 36 }, (_, i) => {
        const pos = i + 1;
        const animal = path[i];
        const { x, y, cx } = getTileCoord(pos);
        const n = countAt(farmers, pos);
        const isTarget = selAnimal >= 0 && animal === selAnimal && n === 0;
        const isFull = selAnimal >= 0 && animal === selAnimal && n > 0;

        return (
          <g key={pos}>
            <rect
              x={x}
              y={y}
              width={52}
              height={52}
              rx={6}
              fill={isTarget ? "#E6F1FB" : "#F1EFE8"}
              stroke={isTarget ? "#378ADD" : isFull ? "#E24B4A" : "#B4B2A9"}
              strokeWidth={isTarget ? 1.5 : 1}
            />
            <text x={cx} y={y + 18} textAnchor="middle" fontSize={16}>
              {ANIMALS[animal].e}
            </text>
            <text
              x={cx}
              y={y + 46}
              textAnchor="middle"
              fontSize={8}
              fill="#888780"
            >
              {ANIMALS[animal].n}
            </text>
            <TileTokens pos={pos} tileX={x} tileY={y} />
          </g>
        );
      })}

      {/* Row 0 arrows L→R */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <line
          key={`r0${i}`}
          x1={TILE_X[i] + 52}
          y1={21}
          x2={TILE_X[i + 1]}
          y2={21}
          stroke="#B4B2A9"
          strokeWidth={1.5}
          markerEnd="url(#arr)"
        />
      ))}
      {/* Turn Row0→Row1 (right side, straight) */}
      <line
        x1={654}
        y1={60}
        x2={654}
        y2={73}
        stroke="#B4B2A9"
        strokeWidth={1.5}
        markerEnd="url(#arr)"
      />

      {/* Row 1 arrows R→L */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <line
          key={`r1${i}`}
          x1={TILE_X[8 - i]}
          y1={99}
          x2={TILE_X[8 - i - 1] + 52}
          y2={99}
          stroke="#B4B2A9"
          strokeWidth={1.5}
          markerEnd="url(#arr)"
        />
      ))}
      {/* Turn Row1→Row2 (left side, straight) */}
      <line
        x1={126}
        y1={125}
        x2={126}
        y2={138}
        stroke="#B4B2A9"
        strokeWidth={1.5}
        markerEnd="url(#arr)"
      />

      {/* Row 2 arrows L→R */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <line
          key={`r2${i}`}
          x1={TILE_X[i] + 52}
          y1={164}
          x2={TILE_X[i + 1]}
          y2={164}
          stroke="#B4B2A9"
          strokeWidth={1.5}
          markerEnd="url(#arr)"
        />
      ))}
      {/* Turn Row2→Row3 (right side, straight) */}
      <line
        x1={654}
        y1={190}
        x2={654}
        y2={203}
        stroke="#B4B2A9"
        strokeWidth={1.5}
        markerEnd="url(#arr)"
      />

      {/* Row 3 arrows R→L */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <line
          key={`r3${i}`}
          x1={TILE_X[8 - i]}
          y1={229}
          x2={TILE_X[8 - i - 1] + 52}
          y2={229}
          stroke="#B4B2A9"
          strokeWidth={1.5}
          markerEnd="url(#arr)"
        />
      ))}
      <line
        x1={100}
        y1={229}
        x2={90}
        y2={229}
        stroke="#B4B2A9"
        strokeWidth={1.5}
        markerEnd="url(#arr)"
      />

      {/* Farmhouse */}
      <rect
        x={8}
        y={203}
        width={80}
        height={52}
        rx={8}
        fill="#FAEEDA"
        stroke="#854F0B"
        strokeWidth={1.5}
      />
      <text x={48} y={219} textAnchor="middle" fontSize={16}>
        🏠
      </text>
      <text
        x={48}
        y={245}
        textAnchor="middle"
        fontSize={9}
        fill="#854F0B"
        fontWeight="500"
      >
        Farmhouse
      </text>
      <BigZoneSummary pos={FARMHOUSE} cx={48} topY={203} zoneH={52} />
    </svg>
  );
}
