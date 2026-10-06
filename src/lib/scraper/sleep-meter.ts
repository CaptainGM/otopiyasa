/**
 * Bilgisayarın uykuda geçirdiği süreyi ölçer. Uykuda zamanlayıcılar durur; uyanınca bir sonraki tık
 * beklenenden çok geç gelir. Aradaki fark uyku (ya da program donması) sayılır ve çalışma süresinden
 * düşülür: aksi hâlde uykudan önce başlamış tek bir parti "3 saat çalıştı" diye yazılıyordu.
 */
export class SleepMeter {
  private last: number;
  private slept = 0;

  constructor(
    private readonly tickMs = 5_000,
    private readonly thresholdMs = 30_000,
    private readonly now: () => number = Date.now
  ) {
    this.last = this.now();
  }

  /** Zamanlayıcı her tıkladığında çağrılır; beklenenden fazla geçen süre uyku sayılır. */
  tick(): void {
    const t = this.now();
    const late = t - this.last - this.tickMs;
    if (late > this.thresholdMs) this.slept += late;
    this.last = t;
  }

  /** Şimdiye kadar ölçülen toplam uyku süresi (ms). */
  total(): number {
    return this.slept;
  }

  /** Zamanlayıcıyı başlatır; süreç kapanmasını engellemez. */
  start(): () => void {
    const timer = setInterval(() => this.tick(), this.tickMs);
    timer.unref();
    return () => clearInterval(timer);
  }
}
