import { useState, useRef } from "react";

// ─── Music Theory ─────────────────────────────────────────────────────────────

const NOTES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const ENHARMONIC = { "C#":"Db","D#":"Eb","F#":"Gb","G#":"Ab","A#":"Bb" };
const NOTE_LABELS = NOTES.map(n => ENHARMONIC[n] ? `${n} / ${ENHARMONIC[n]}` : n);

const CHORD_TYPES = [
  { suffix: "",    label: "maj",  intervals: [0,4,7]  },
  { suffix: "m",   label: "min",  intervals: [0,3,7]  },
  { suffix: "7",   label: "dom7", intervals: [0,4,7,10] },
  { suffix: "maj7",label: "maj7", intervals: [0,4,7,11] },
  { suffix: "m7",  label: "min7", intervals: [0,3,7,10] },
  { suffix: "sus2",label: "sus2", intervals: [0,2,7]  },
  { suffix: "sus4",label: "sus4", intervals: [0,5,7]  },
];

function addSemitones(note, n) { return NOTES[(NOTES.indexOf(note) + n + 120) % 12]; }

// Build every chord name → note set
const ALL_CHORDS = [];
NOTES.forEach(root => {
  CHORD_TYPES.forEach(type => {
    ALL_CHORDS.push({
      name: `${root}${type.suffix}`,
      label: `${root}${type.suffix}`,
      root,
      type: type.label,
      notes: type.intervals.map(i => addSemitones(root, i)),
    });
  });
});

// Common chord buttons to show (root × maj/min)
const COMMON_CHORDS = [];
NOTES.forEach(root => {
  COMMON_CHORDS.push({ name: root,       display: root,       root, quality: "maj" });
  COMMON_CHORDS.push({ name: `${root}m`, display: `${root}m`, root, quality: "min" });
});

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a guitar teacher writing in the voice and style of the website unlocktheguitar.net. Your tone is direct, no-nonsense, occasionally irreverent, and always practical. You explain music theory in plain English — no jargon without explanation, no random patterns without context. You believe everything should connect back to key signatures and diatonic harmony.

When given a list of chords a guitarist is playing, you:
1. Identify the most likely key (or keys if ambiguous) — explain WHY these chords point to that key using Roman numerals and diatonic harmony. Be specific.
2. If there are multiple possible keys, acknowledge it briefly, pick the most likely one, and move on.
3. Recommend the 2–3 most useful scales for improvising over these chords — start with the most obvious, then give one slightly more interesting option. For each scale, say WHERE to start on the neck (e.g. "5th fret, low E string") and what it'll sound like.
4. End with one punchy, memorable insight — something that makes the guitarist go "oh, that's why."

Keep it tight. No waffle. Write in short paragraphs, not bullet lists. Sound like a teacher, not a textbook.`;

const THEMES = {
  dark: {
    bg:"#111008", surface:"#1c1a0f", surface2:"#252210",
    border:"#2e2a14", text:"#e8e0c8", textMid:"#c8bfa8", textLo:"#a09870", textMute:"#6b6440",
    accent:"#E8C547", accentBg:"#111008",
    resultText1:"#f0e8d0", resultText2:"#c8bfa8",
    inputBg:"#252210", errorBg:"#1c0a0a", errorBorder:"#7f1d1d", errorText:"#fca5a5",
    scrollBg:"#1c1a0f", scrollTh:"#2e2a14",
  },
  light: {
    bg:"#fafaf7", surface:"#ffffff", surface2:"#f5f4ef",
    border:"#e0ddd0", text:"#2d2a1e", textMid:"#3d3a2a", textLo:"#5a5540", textMute:"#8a8468",
    accent:"#b8960a", accentBg:"#fafaf7",
    resultText1:"#1a1810", resultText2:"#3d3a2a",
    inputBg:"#f5f4ef", errorBg:"#fef2f2", errorBorder:"#fca5a5", errorText:"#dc2626",
    scrollBg:"#f5f4ef", scrollTh:"#e0ddd0",
  },
};

export default function WhatKeyAmIIn() {
  const [selectedChords, setSelectedChords] = useState([]);
  const [customInput,    setCustomInput]    = useState("");
  const [analysis,       setAnalysis]       = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);
  const [showCustom,     setShowCustom]     = useState(false);
  const [isDark,         setIsDark]         = useState(true);
  const resultRef = useRef(null);

  const T = isDark ? THEMES.dark : THEMES.light;

  const toggleChord = (name) => {
    setSelectedChords(prev => prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]);
    setAnalysis(null);
  };
  const addCustomChord = () => {
    const trimmed = customInput.trim();
    if (trimmed && !selectedChords.includes(trimmed)) { setSelectedChords(prev => [...prev, trimmed]); setAnalysis(null); }
    setCustomInput("");
  };
  const removeChord = (name) => { setSelectedChords(prev => prev.filter(c => c !== name)); setAnalysis(null); };
  const reset = () => { setSelectedChords([]); setAnalysis(null); setError(null); setCustomInput(""); };

  const analyse = async () => {
    if (selectedChords.length < 2) return;
    setLoading(true); setError(null); setAnalysis(null);
    try {
      const userMessage = `I've been playing these chords: ${selectedChords.join(", ")}. What key am I in, and what scales should I use?`;
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, system:SYSTEM_PROMPT, messages:[{role:"user",content:userMessage}] }),
      });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      const text = data.content?.find(b => b.type==="text")?.text || "";
      setAnalysis(text);
      setTimeout(() => resultRef.current?.scrollIntoView({behavior:"smooth",block:"start"}), 100);
    } catch (e) {
      setError("Couldn't reach the analysis engine. Check your connection and try again.");
    } finally { setLoading(false); }
  };

  const chordRows = NOTES.map(root => ({ root, maj:root, min:`${root}m` }));

  return (
    <div style={{ minHeight:"100vh", background:T.bg, color:T.text, fontFamily:"'Lora',Georgia,serif", padding:"28px 18px 48px", transition:"background 0.2s,color 0.2s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;1,400&family=Fira+Code:wght@400;600&display=swap');
        * { box-sizing:border-box; }
        button { cursor:pointer; font-family:inherit; }
        input  { font-family:inherit; }
        ::selection { background:${T.accent}44; }
        ::-webkit-scrollbar { width:5px; height:5px; background:${T.scrollBg}; }
        ::-webkit-scrollbar-thumb { background:${T.scrollTh}; border-radius:3px; }
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin   { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .chord-btn { transition:all 0.12s ease; }
        .chord-btn:hover { border-color:${T.accent}88 !important; color:${T.accent} !important; }
        .analyse-btn:hover:not(:disabled) { background:${T.accent} !important; color:${T.accentBg} !important; transform:translateY(-1px); }
        .analyse-btn:disabled { opacity:0.35; cursor:not-allowed; }
      `}</style>

      <div style={{ maxWidth:"720px", margin:"0 auto" }}>

        {/* ── Header ── */}
        <div style={{ marginBottom:"32px" }}>
          <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:"12px", marginBottom:"8px" }}>
            <div>
              <div style={{ fontFamily:"'Fira Code',monospace", fontSize:"10px", color:T.accent, letterSpacing:"2px", marginBottom:"8px", opacity:0.8 }}>UNLOCK THE GUITAR</div>
              <h1 style={{ fontFamily:"'Lora',serif", fontSize:"clamp(30px,6vw,48px)", fontWeight:"400", fontStyle:"italic", margin:"0 0 8px", color:T.resultText1, lineHeight:"1.15", letterSpacing:"-0.5px" }}>
                What Key Am I In?
              </h1>
            </div>
            <button onClick={() => setIsDark(d=>!d)} style={{ flexShrink:0, marginTop:"4px", padding:"8px 14px", borderRadius:"20px", border:`1.5px solid ${T.border}`, background:T.surface, color:T.textMute, fontSize:"13px", display:"flex", alignItems:"center", gap:"6px", transition:"all 0.15s", whiteSpace:"nowrap" }}>
              <span style={{ fontSize:"16px" }}>{isDark?"☀️":"🌙"}</span>
              <span style={{ fontSize:"11px", fontFamily:"'Fira Code',monospace", letterSpacing:"0.5px" }}>{isDark?"Light":"Dark"}</span>
            </button>
          </div>
          <p style={{ color:T.textMute, fontSize:"15px", margin:0, lineHeight:"1.6" }}>
            Tap the chords you're playing. Find out your key, why it works, and what to play over it.
          </p>
        </div>

        {/* ── Chord Picker ── */}
        <div style={{ background:T.surface, borderRadius:"16px", padding:"20px", border:`1px solid ${T.border}`, marginBottom:"14px" }}>
          <div style={{ fontFamily:"'Fira Code',monospace", fontSize:"10px", color:T.textMute, letterSpacing:"1.5px", marginBottom:"14px" }}>SELECT YOUR CHORDS</div>
          <div style={{ display:"flex", flexDirection:"column", gap:"5px" }}>
            {chordRows.map(({ root, maj, min }) => (
              <div key={root} style={{ display:"flex", gap:"5px", alignItems:"center" }}>
                <div style={{ width:"28px", flexShrink:0, fontFamily:"'Fira Code',monospace", fontSize:"11px", color:T.textMute, textAlign:"right", paddingRight:"4px" }}>{root}</div>
                {[maj, min].map(chord => {
                  const active = selectedChords.includes(chord);
                  return (
                    <button key={chord} className="chord-btn" onClick={() => toggleChord(chord)} style={{
                      padding:"6px 0", width:"54px", borderRadius:"7px",
                      border: active ? `1.5px solid ${T.accent}` : `1.5px solid ${T.border}`,
                      background: active ? `${T.accent}18` : T.surface2,
                      color: active ? T.accent : T.textLo,
                      fontSize:"12px", fontWeight:active?"600":"400", fontFamily:"'Fira Code',monospace",
                    }}>{chord}</button>
                  );
                })}
              </div>
            ))}
          </div>

          <div style={{ marginTop:"14px", paddingTop:"14px", borderTop:`1px solid ${T.border}` }}>
            <button onClick={() => setShowCustom(v=>!v)} style={{ background:"none", border:"none", color:T.textMute, fontSize:"12px", fontFamily:"'Fira Code',monospace", padding:0, letterSpacing:"0.5px" }}>
              {showCustom?"▾":"▸"} Add a chord not listed (7ths, sus, etc.)
            </button>
            {showCustom && (
              <div style={{ display:"flex", gap:"8px", marginTop:"10px" }}>
                <input value={customInput} onChange={e=>setCustomInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCustomChord()} placeholder="e.g. Bm7, Gsus4, Fmaj7"
                  style={{ flex:1, padding:"8px 12px", background:T.inputBg, border:`1.5px solid ${T.border}`, borderRadius:"8px", color:T.text, fontSize:"13px", outline:"none" }}/>
                <button onClick={addCustomChord} style={{ padding:"8px 16px", borderRadius:"8px", border:`1.5px solid ${T.border}`, background:T.surface2, color:T.accent, fontSize:"13px", fontFamily:"'Fira Code',monospace" }}>Add</button>
              </div>
            )}
          </div>
        </div>

        {/* ── Selected chords tray ── */}
        {selectedChords.length > 0 && (
          <div style={{ background:T.surface, borderRadius:"12px", padding:"14px 16px", border:`1px solid ${T.border}`, marginBottom:"14px", animation:"fadeUp 0.2s ease" }}>
            <div style={{ fontFamily:"'Fira Code',monospace", fontSize:"10px", color:T.textMute, letterSpacing:"1.5px", marginBottom:"10px" }}>YOUR CHORDS ({selectedChords.length})</div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:"7px" }}>
              {selectedChords.map(chord => (
                <div key={chord} style={{ display:"flex", alignItems:"center", gap:"5px", padding:"5px 10px 5px 12px", background:`${T.accent}15`, border:`1.5px solid ${T.accent}55`, borderRadius:"20px", animation:"fadeUp 0.15s ease" }}>
                  <span style={{ fontSize:"13px", fontWeight:"600", fontFamily:"'Fira Code',monospace", color:T.accent }}>{chord}</span>
                  <button onClick={() => removeChord(chord)} style={{ background:"none", border:"none", color:T.textMute, fontSize:"14px", padding:"0 0 0 2px", lineHeight:1, display:"flex", alignItems:"center" }}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Action buttons ── */}
        <div style={{ display:"flex", gap:"10px", marginBottom:"24px" }}>
          <button className="analyse-btn" onClick={analyse} disabled={loading||selectedChords.length<2} style={{
            flex:1, padding:"14px", borderRadius:"10px",
            border:`1.5px solid ${T.accent}`, background:"transparent", color:T.accent,
            fontSize:"14px", fontWeight:"600", fontFamily:"'Fira Code',monospace",
            letterSpacing:"1px", transition:"all 0.15s ease",
          }}>
            {loading ? (
              <span style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:"10px" }}>
                <span style={{ width:"14px", height:"14px", border:`2px solid ${T.accent}44`, borderTopColor:T.accent, borderRadius:"50%", display:"inline-block", animation:"spin 0.7s linear infinite" }}/>
                Analysing…
              </span>
            ) : selectedChords.length<2 ? "Select at least 2 chords" : "→ Find My Key"}
          </button>
          {(selectedChords.length>0||analysis) && (
            <button onClick={reset} style={{ padding:"14px 18px", borderRadius:"10px", border:`1.5px solid ${T.border}`, background:"none", color:T.textMute, fontSize:"13px", fontFamily:"'Fira Code',monospace", transition:"all 0.12s" }}>Reset</button>
          )}
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ padding:"14px 16px", borderRadius:"10px", border:`1px solid ${T.errorBorder}`, background:T.errorBg, color:T.errorText, fontSize:"13px", marginBottom:"20px", animation:"fadeUp 0.2s ease" }}>
            {error}
          </div>
        )}

        {/* ── Analysis result ── */}
        {analysis && (
          <div ref={resultRef} style={{ background:T.surface, borderRadius:"16px", border:`1px solid ${T.border}`, overflow:"hidden", animation:"fadeUp 0.3s ease" }}>
            <div style={{ padding:"16px 20px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:"10px" }}>
              <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:T.accent, boxShadow:`0 0 10px ${T.accent}` }}/>
              <span style={{ fontFamily:"'Fira Code',monospace", fontSize:"10px", color:T.accent, letterSpacing:"2px" }}>
                KEY ANALYSIS — {selectedChords.join(" · ")}
              </span>
            </div>
            <div style={{ padding:"22px 24px" }}>
              {analysis.split("\n\n").map((para, i) => (
                para.trim() && (
                  <p key={i} style={{ fontSize:"15px", lineHeight:"1.75", color:i===0?T.resultText1:T.resultText2, margin:"0 0 16px", fontStyle:i===analysis.split("\n\n").length-2?"italic":"normal" }}>
                    {para.trim()}
                  </p>
                )
              ))}
            </div>
            <div style={{ padding:"12px 20px", borderTop:`1px solid ${T.border}`, fontFamily:"'Fira Code',monospace", fontSize:"11px", color:T.textMute }}>
              unlocktheguitar.net — try different chord combos to explore related keys
            </div>
          </div>
        )}

        {!analysis && !loading && selectedChords.length===0 && (
          <div style={{ textAlign:"center", padding:"32px 20px", color:T.textMute, fontSize:"13px", lineHeight:"1.7", fontStyle:"italic" }}>
            Not sure what chords you've got?<br/>
            Just tap everything you've been playing and let the analysis sort it out.
          </div>
        )}

      </div>
    </div>
  );
}
