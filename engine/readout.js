// Monotone readouts g: ℝ→ℝ applied to the linear core of a measure.
// They obscure the underlying linearity WITHOUT breaking learnability:
// g is strictly monotone, so bisection/IVT on the observed value still converges,
// and the smart bot can invert g to work in linear space.

export function applyReadout(readout, u) {
  switch (readout.kind) {
    case "id":
      return u;
    case "tanh":
      return readout.A * Math.tanh(readout.k * u);
    default:
      return u;
  }
}

export function invertReadout(readout, y) {
  switch (readout.kind) {
    case "id":
      return y;
    case "tanh": {
      const z = Math.max(-0.999999, Math.min(0.999999, y / readout.A));
      return Math.atanh(z) / readout.k;
    }
    default:
      return y;
  }
}
