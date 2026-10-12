// Radix-2 FFT ported from the textbook Cooley–Tukey algorithm to feed the
// Transkun mel frontend (torch.fft.rfft semantics for power-of-two sizes).
// Runs on Float64Array pairs; the frontend casts down to float32-equivalent
// magnitudes afterwards.

export function fftForwardInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let j = 0; j < half; j++) {
        const a = i + j;
        const b = a + half;
        const uRe = re[a];
        const uIm = im[a];
        const vRe = re[b] * curRe - im[b] * curIm;
        const vIm = re[b] * curIm + im[b] * curRe;
        re[a] = uRe + vRe;
        im[a] = uIm + vIm;
        re[b] = uRe - vRe;
        im[b] = uIm - vIm;
        const nRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nRe;
      }
    }
  }
}

// Real FFT power spectrum with orthonormal normalization, matching
// torch.fft.rfft(norm="ortho"): out[k] for k in [0, n/2], power scale.
export function rfftOrthoPower(
  x: ArrayLike<number>,
  out: Float64Array,
  scratchRe: Float64Array,
  scratchIm: Float64Array,
): void {
  const n = x.length;
  for (let i = 0; i < n; i++) {
    scratchRe[i] = x[i];
    scratchIm[i] = 0;
  }
  fftForwardInPlace(scratchRe, scratchIm);
  const scale = 1 / Math.sqrt(n);
  const half = n >> 1;
  for (let k = 0; k <= half; k++) {
    const r = scratchRe[k] * scale;
    const m = scratchIm[k] * scale;
    out[k] = r * r + m * m;
  }
}
