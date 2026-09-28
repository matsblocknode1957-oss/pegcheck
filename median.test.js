// Pure Node test — no network required. Run with: node median.test.js

function median(values) {
  const valid = values.filter(v => isFinite(v) && v > 0);
  if (valid.length === 0) return null;
  const sorted = [...valid].sort((a, b) => a - b);
  const rawMid = Math.floor(sorted.length / 2);
  const raw = sorted.length % 2 !== 0
    ? sorted[rawMid]
    : (sorted[rawMid - 1] + sorted[rawMid]) / 2;
  if (valid.length < 3) return raw;
  const trimmed = sorted.filter(v => Math.abs(v - raw) / raw <= 0.20);
  if (trimmed.length === 0) return raw;
  const mid = Math.floor(trimmed.length / 2);
  return trimmed.length % 2 !== 0
    ? trimmed[mid]
    : (trimmed[mid - 1] + trimmed[mid]) / 2;
}

const tests = [
  {
    label: "depeg visible",
    input: [0.30, 0.31, 0.29],
    check: r => r !== null && Math.abs(r - 0.30) < 0.01,
    expected: "~0.30",
  },
  {
    label: "outlier 0.40 rejected",
    input: [1.0, 0.999, 1.001, 0.40],
    check: r => r !== null && Math.abs(r - 1.0) < 0.01,
    expected: "~1.0",
  },
  {
    label: "EURC ~1.17 works",
    input: [1.17, 1.168, 1.171],
    check: r => r !== null && Math.abs(r - 1.17) < 0.01,
    expected: "~1.17",
  },
  {
    label: "all zeros → null",
    input: [0, 0, 0],
    check: r => r === null,
    expected: "null",
  },
  {
    label: "empty → null",
    input: [],
    check: r => r === null,
    expected: "null",
  },
];

let passed = 0;
let failed = 0;
for (const t of tests) {
  const result = median(t.input);
  if (t.check(result)) {
    console.log(`  PASS  [${t.label}]  median([${t.input}]) → ${result}  (expected ${t.expected})`);
    passed++;
  } else {
    console.log(`  FAIL  [${t.label}]  median([${t.input}]) → ${result}  (expected ${t.expected})`);
    failed++;
  }
}
console.log(`\n${passed}/${passed + failed} passed`);
if (failed > 0) process.exit(1);
