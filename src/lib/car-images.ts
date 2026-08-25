const brandImages: Record<string, string> = {
  Toyota:
    "https://images.unsplash.com/photo-1623869675781-0ecb64375144?auto=format&fit=crop&w=1200&q=80",
  Honda:
    "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=1200&q=80",
  Volkswagen:
    "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=1200&q=80",
  BMW:
    "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=1200&q=80",
  Renault:
    "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1200&q=80",
  Mercedes:
    "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=1200&q=80",
  Ford:
    "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=1200&q=80",
  Hyundai:
    "https://images.unsplash.com/photo-1609521263047-f8f205293bb4?auto=format&fit=crop&w=1200&q=80",
  Audi:
    "https://images.unsplash.com/photo-1603584171295-0a4f46994906?auto=format&fit=crop&w=1200&q=80",
  Fiat:
    "https://images.unsplash.com/photo-1489824904134-891ab64532f1?auto=format&fit=crop&w=1200&q=80",
  Tesla:
    "https://images.unsplash.com/photo-1560958089-b8a1929cea89?auto=format&fit=crop&w=1200&q=80",
  Peugeot:
    "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=80",
};

const bodyTypeImages: Record<string, string> = {
  SUV: "https://images.unsplash.com/photo-1519690779288-4d9c1a1a2c1b?auto=format&fit=crop&w=1200&q=80",
  Hatchback:
    "https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=1200&q=80",
  Sedan:
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80",
};

export function resolveCarImage(
  brand: string,
  bodyType = "Sedan",
  scrapedImage?: string
) {
  if (scrapedImage && scrapedImage.startsWith("http")) {
    return scrapedImage;
  }
  return (
    brandImages[brand] ||
    bodyTypeImages[bodyType] ||
    bodyTypeImages.Sedan
  );
}

export function applySeedImages<T extends { brand: string; features: { bodyType: string }; imageUrl: string }>(
  cars: T[]
) {
  return cars.map((car) => ({
    ...car,
    imageUrl: resolveCarImage(car.brand, car.features.bodyType, car.imageUrl),
  }));
}
