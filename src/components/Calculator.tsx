"use client";

import { useState, useEffect } from "react";

export function Calculator() {
  const [display, setDisplay] = useState("0");
  const [memory, setMemory] = useState<number | null>(null);
  const [isRad, setIsRad] = useState(false);
  const [error, setError] = useState(false);

  // A simplified evaluation using the built-in Function constructor for basic math safely
  const evaluate = (expr: string) => {
    try {
      const sanitized = expr.replace(/[^-()\d/*+.]/g, '');
      // eslint-disable-next-line no-new-func
      const result = new Function(`return ${sanitized}`)();
      if (!isFinite(result) || isNaN(result)) throw new Error("Math Error");
      return Number.isInteger(result) ? String(result) : String(parseFloat(result.toFixed(6)));
    } catch {
      return "Error";
    }
  };

  const handleInput = (val: string) => {
    if (error) { setDisplay(val); setError(false); return; }
    if (display === "0" && val !== ".") {
      setDisplay(val);
    } else {
      setDisplay(display + val);
    }
  };

  const calculate = () => {
    if (error) return;
    const res = evaluate(display);
    setDisplay(res);
    if (res === "Error") setError(true);
  };

  const executeMath = (fn: (x: number) => number) => {
    if (error) return;
    const current = parseFloat(display);
    if (!isNaN(current)) {
      const result = fn(current);
      if (!isFinite(result) || isNaN(result)) {
        setDisplay("Error");
        setError(true);
      } else {
        setDisplay(Number.isInteger(result) ? String(result) : String(parseFloat(result.toFixed(6))));
      }
    }
  };

  const trig = (fn: (x: number) => number) => {
    if (error) return;
    const current = parseFloat(display);
    if (isNaN(current)) return;
    const val = isRad ? current : current * (Math.PI / 180);
    executeMath(() => fn(val));
  };

  const buttons = [
    { label: "MC", onClick: () => setMemory(null) },
    { label: "MR", onClick: () => { if (memory !== null) setDisplay(String(memory)); } },
    { label: "MS", onClick: () => setMemory(parseFloat(display)) },
    { label: "M+", onClick: () => setMemory((memory || 0) + parseFloat(display)) },
    { label: "M-", onClick: () => setMemory((memory || 0) - parseFloat(display)) },
    
    { label: "rad", onClick: () => setIsRad(true), active: isRad },
    { label: "deg", onClick: () => setIsRad(false), active: !isRad },
    { label: "x²", onClick: () => executeMath(x => x * x) },
    { label: "√", onClick: () => executeMath(Math.sqrt) },
    { label: "1/x", onClick: () => executeMath(x => 1 / x) },

    { label: "sin", onClick: () => trig(Math.sin) },
    { label: "cos", onClick: () => trig(Math.cos) },
    { label: "tan", onClick: () => trig(Math.tan) },
    { label: "ln", onClick: () => executeMath(Math.log) },
    { label: "log", onClick: () => executeMath(Math.log10) },

    { label: "7", onClick: () => handleInput("7") },
    { label: "8", onClick: () => handleInput("8") },
    { label: "9", onClick: () => handleInput("9") },
    { label: "DEL", onClick: () => setDisplay(display.length > 1 ? display.slice(0, -1) : "0") },
    { label: "AC", onClick: () => { setDisplay("0"); setError(false); } },

    { label: "4", onClick: () => handleInput("4") },
    { label: "5", onClick: () => handleInput("5") },
    { label: "6", onClick: () => handleInput("6") },
    { label: "*", onClick: () => handleInput("*") },
    { label: "/", onClick: () => handleInput("/") },

    { label: "1", onClick: () => handleInput("1") },
    { label: "2", onClick: () => handleInput("2") },
    { label: "3", onClick: () => handleInput("3") },
    { label: "+", onClick: () => handleInput("+") },
    { label: "-", onClick: () => handleInput("-") },

    { label: "0", onClick: () => handleInput("0") },
    { label: ".", onClick: () => handleInput(".") },
    { label: "±", onClick: () => executeMath(x => -x) },
    { label: "π", onClick: () => { setDisplay(String(Math.PI.toFixed(6))); setError(false); } },
    { label: "=", onClick: calculate, primary: true },
  ];

  return (
    <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "12px", width: "340px", padding: "16px", boxShadow: "0 10px 40px rgba(0,0,0,0.15)", display: "flex", flexDirection: "column", gap: "12px", fontFamily: "var(--font-sans)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
        <span style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "-0.02em" }}>GATE Scientific Calculator</span>
        {memory !== null && <span style={{ fontSize: "12px", fontWeight: 700, background: "var(--color-primary)", color: "white", padding: "2px 6px", borderRadius: "4px" }}>M</span>}
      </div>
      
      <div style={{ background: "var(--color-section)", border: "1px solid var(--color-border)", borderRadius: "8px", padding: "16px", fontSize: "28px", fontFamily: "var(--font-mono)", textAlign: "right", minHeight: "68px", display: "flex", alignItems: "center", justifyContent: "flex-end", overflowX: "auto", color: error ? "var(--color-danger)" : "var(--color-text)" }}>
        {display}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "6px", marginTop: "4px" }}>
        {buttons.map((b, i) => (
          <button
            key={i}
            onClick={b.onClick}
            style={{
              padding: "10px 0",
              fontSize: "13px",
              fontWeight: 600,
              borderRadius: "8px",
              border: `1px solid ${b.active ? "var(--color-primary)" : "var(--color-border)"}`,
              background: b.primary ? "var(--color-primary)" : b.active ? "var(--color-primary-light)" : "var(--color-surface)",
              color: b.primary ? "white" : b.active ? "var(--color-primary)" : "var(--color-text)",
              cursor: "pointer",
              transition: "all 0.1s"
            }}
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}
