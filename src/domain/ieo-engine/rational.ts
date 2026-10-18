// Exact non-negative-or-signed rational numbers on BigInt. The engine never rounds intermediate
// values (S03 §13, S12 T21): every sum and mean stays an exact fraction until presentation.
const gcd = (a: bigint, b: bigint): bigint => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a; };

export class Rational {
  readonly num: bigint;
  readonly den: bigint;
  private constructor(num: bigint, den: bigint) {
    if (den === 0n) throw new RangeError("División entre cero.");
    if (den < 0n) { num = -num; den = -den; }
    const divisor = gcd(num, den) || 1n;
    this.num = num / divisor;
    this.den = den / divisor;
  }
  static of(num: bigint | number, den: bigint | number = 1n) { return new Rational(BigInt(num), BigInt(den)); }
  /** Parses a finite decimal literal exactly ("66.6666666667" → 666666666667/10000000000). */
  static fromDecimal(text: string) {
    const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text.trim());
    if (!match) throw new RangeError(`Decimal inválido: ${text}`);
    const [, sign, whole, fraction = ""] = match;
    return new Rational(BigInt(`${sign}${whole}${fraction}`), 10n ** BigInt(fraction.length));
  }
  static mean(values: readonly Rational[]) {
    if (!values.length) throw new RangeError("Promedio sin valores.");
    return values.reduce((sum, value) => sum.add(value), Rational.of(0)).div(values.length);
  }
  add(other: Rational) { return new Rational(this.num * other.den + other.num * this.den, this.den * other.den); }
  sub(other: Rational) { return new Rational(this.num * other.den - other.num * this.den, this.den * other.den); }
  mul(factor: bigint | number) { return new Rational(this.num * BigInt(factor), this.den); }
  div(divisor: bigint | number) { return new Rational(this.num, this.den * BigInt(divisor)); }
  compare(other: Rational) { const left = this.num * other.den, right = other.num * this.den; return left < right ? -1 : left > right ? 1 : 0; }
  equals(other: Rational) { return this.num === other.num && this.den === other.den; }
  /** Nearest integer where an exact .5 rounds down (GAP-007, Marco 2026-10-16: 79.5 → 79, 79.6 → 80). Values ≥ 0. */
  roundHalfDown() {
    if (this.num < 0n) throw new RangeError("Redondeo definido sólo para valores no negativos.");
    const floor = this.num / this.den;
    const remainder = this.num - floor * this.den;
    return Number(remainder * 2n > this.den ? floor + 1n : floor);
  }
  /** Decimal projection truncated toward zero after `digits` places (display/query only, never an input). */
  toDecimal(digits = 12) {
    const negative = this.num < 0n;
    const absolute = negative ? -this.num : this.num;
    const scaled = absolute * 10n ** BigInt(digits) / this.den;
    const text = scaled.toString().padStart(digits + 1, "0");
    const whole = text.slice(0, text.length - digits), fraction = text.slice(text.length - digits).replace(/0+$/, "");
    return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
  }
  toNumber() { return Number(this.toDecimal(15)); }
  toJSON() { return { exact: `${this.num}/${this.den}`, decimal: this.toDecimal(12) }; }
}
