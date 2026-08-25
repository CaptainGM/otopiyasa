import { Car } from "@/types";



export interface Deal {
  car: Car;
  label: string;
  
  score: number;
}

export const DEAL_MIN_YEAR = 2010;
export const DEAL_MAX_MILEAGE = 150_000;

export const DEAL_MAX_DISCOUNT = 0.45;

export const DEAL_MIN_DISCOUNT = 0.12;
const DEAL_MIN_COMPARABLES = 3;

function lastDropPercent(car: Car): number {
  const history = car.priceHistory;
  if (!history || history.length < 2) return 0;
  const previous = history[history.length - 2].price;
  const current = history[history.length - 1].price;
  if (current >= previous || previous <= 0) return 0;
  return Math.round(((previous - current) / previous) * 100);
}


export function isSellableQuality(car: Car): boolean {
  return (
    car.year >= DEAL_MIN_YEAR &&
    car.mileage <= DEAL_MAX_MILEAGE &&
    !car.damageFlag &&
    car.price > 0
  );
}

export function pickDeals(cars: Car[], limit = 8): Deal[] {
  const deals: Deal[] = [];

  for (const car of cars) {
    if (!isSellableQuality(car)) continue;

    
    if (car.marketAvgPrice && (car.marketListingCount || 0) >= DEAL_MIN_COMPARABLES) {
      const discount = 1 - car.price / car.marketAvgPrice;
      if (discount >= DEAL_MIN_DISCOUNT && discount <= DEAL_MAX_DISCOUNT) {
        deals.push({
          car,
          label: `Piyasanın %${Math.round(discount * 100)} altı`,
          score: discount,
        });
        continue;
      }
    }

    
    const drop = lastDropPercent(car);
    if (drop >= 5) {
      deals.push({ car, label: `Fiyat düştü %${drop}`, score: drop / 100 });
    }
  }

 
  return deals.sort((a, b) => b.score - a.score).slice(0, limit);
}
