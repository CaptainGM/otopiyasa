import { Car } from "@/types";


export function pickTrending(cars: Car[], limit = 8): Car[] {
  return cars
    .filter((car) => (car.viewCount || 0) > 0)
    .sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0))
    .slice(0, limit);
}
