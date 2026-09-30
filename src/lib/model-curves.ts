

export interface CurveCar {
  brand: string;
  model: string;
  year: number;
  price: number;
}

export interface ModelCurvePoint {
  year: number;
  [segment: string]: number | null;
}

export interface ModelCurves {
  segments: string[]; 
  points: ModelCurvePoint[];
}

export function buildModelCurves(
  cars: CurveCar[],
  maxSegments = 5,
  minListings = 5
): ModelCurves {
  const valid = cars.filter(
    (car) => car.brand && car.model && car.price > 0 && car.year >= 1990
  );

  const bySegment = new Map<string, CurveCar[]>();
  for (const car of valid) {
    const key = `${car.brand} ${car.model}`;
    if (!bySegment.has(key)) bySegment.set(key, []);
    bySegment.get(key)!.push(car);
  }

  
  const segments = [...bySegment.entries()]
    .filter(
      ([, list]) =>
        list.length >= minListings && new Set(list.map((c) => c.year)).size >= 3
    )
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, maxSegments)
    .map(([key]) => key);

  if (segments.length === 0) return { segments: [], points: [] };

  const years = [
    ...new Set(
      segments.flatMap((key) => bySegment.get(key)!.map((car) => car.year))
    ),
  ].sort((a, b) => a - b);

  const points = years.map((year) => {
    const point: ModelCurvePoint = { year };
    for (const key of segments) {
      const prices = bySegment
        .get(key)!
        .filter((car) => car.year === year)
        .map((car) => car.price);
      point[key] = prices.length
        ? Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length)
        : null;
    }
    return point;
  });

  return { segments, points };
}
