// Semi-CRF backward Viterbi, ported from viterbiBackward in
// Yujia-Yan/Transkun transkun/CRF/NeuralSemiCRFInterval.py (MIT).
//
// S layout is row-major [T, T, B]: S[(e*T + b)*B + k] scores track k
// spanning frames b→e (diagonal e==b = single-frame note). The no-event
// (skip) score is provably 0 for this export, matching the reference.
//
// Arithmetic mirrors float32 ALU (Math.fround on accumulations) so
// max-selection ties break exactly like the torch implementation.

export function viterbiBackward(
  S: Float32Array,
  T: number,
  B: number,
  forcedStartPos: Int32Array | null,
): Array<Array<[number, number]>> {
  if (T < 2 || B < 1) {
    const empty: Array<Array<[number, number]>> = [];
    for (let k = 0; k < B; k++) empty.push([]);
    return empty;
  }
  const at = (e: number, b: number, k: number): number => S[(e * T + b) * B + k];
  const q = new Float32Array(T * B);
  const ptr = new Int32Array(Math.max(0, T - 1) * B);
  for (let k = 0; k < B; k++) {
    const d = at(T - 1, T - 1, k);
    q[(T - 1) * B + k] = d > 0 ? d : 0;
  }
  for (let i = 1; i < T; i++) {
    const j = T - i - 1;
    for (let k = 0; k < B; k++) {
      // Candidate 0: skip frame j (noise score = 0). Strictly-greater
      // replacement below reproduces torch.max's first-index tie-break.
      let best = q[(j + 1) * B + k];
      let sel = -1;
      for (let e = j + 1; e < T; e++) {
        const cand = Math.fround(q[e * B + k] + at(e, j, k));
        if (cand > best) {
          best = cand;
          sel = e - j - 1;
        }
      }
      const dg = at(j, j, k);
      q[j * B + k] = Math.fround(best + (dg > 0 ? dg : 0));
      ptr[j * B + k] = sel;
    }
  }
  const out: Array<Array<[number, number]>> = [];
  for (let k = 0; k < B; k++) {
    const j0 = forcedStartPos ? forcedStartPos[k] : 0;
    let j = j0 < 0 ? 0 : j0 >= T ? T - 1 : j0;
    const cur: Array<[number, number]> = [];
    while (j < T - 1) {
      const sel = ptr[j * B + k];
      if (at(j, j, k) > 0) cur.push([j, j]);
      if (sel < 0) {
        j += 1;
      } else {
        const e = sel + j + 1;
        cur.push([j, e]);
        j = e;
      }
    }
    if (at(T - 1, T - 1, k) > 0) cur.push([T - 1, T - 1]);
    out.push(cur);
  }
  return out;
}
