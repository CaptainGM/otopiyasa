import { describe, expect, it } from "vitest";
import { parseOtomerkeziListHtml } from "@/lib/scraper/otomerkezi";

const sampleItem = {
  "@type": "ListItem",
  position: 1,
  url: "https://www.otomerkezi.net/ikinci-el/araba/2023-volkswagen-polo",
  item: {
    "@type": "Product",
    additionalType: "https://schema.org/Car",
    url: "https://www.otomerkezi.net/ikinci-el/araba/2023-volkswagen-polo",
    name: "VOLKSWAGEN VOLKSWAGEN POLO",
    brand: { "@type": "Brand", name: "VOLKSWAGEN" },
    model: "VOLKSWAGEN POLO",
    image: ["https://asset.otomerkezi.net/car-photo/ornek.jpeg"],
    description:
      "2023 model VOLKSWAGEN POLO 1.0 TSI 95 DSG LIFE. 38.985 KM'de. benzin yakıt, otomatik vites.",
    productionDate: "2023",
    fuelType: "gasoline",
    vehicleTransmission: "automatic",
    offers: {
      "@type": "Offer",
      price: 1399000,
      priceCurrency: "TRY",
      seller: {
        "@type": "AutoDealer",
        address: { "@type": "PostalAddress", addressLocality: "İstanbul" },
      },
    },
  },
};

function pageWith(items: unknown[]) {
  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items,
    },
  };
  return `<html><head><script type="application/ld+json">${JSON.stringify(
    collection
  )}</script></head><body></body></html>`;
}

describe("parseOtomerkeziListHtml (RSC payload)", () => {
  const vehicle = {
    id: "2384",
    slug: "2022-renault-express",
    name: "RENAULT EXPRESS",
    brand: "RENAULT",
    model: "EXPRESS",
    year: 2022,
    mileage: 77000,
    pricePerDay: 689000,
    image: "https://asset.otomerkezi.net/car-photo/x.jpeg",
    images: ["https://asset.otomerkezi.net/car-photo/x.jpeg"],
    description:
      "2022 model RENAULT EXPRESS VAN JOY 1.5 BLUEDCI 95. 77.000 KM'de. dizel yakıt, manuel vites.",
    specs: { transmission: "manual", fuelType: "diesel", engineSize: "", horsepower: 0 },
    dealerLocation: "Merkez",
    tramerAmount: null,
  };

  function rscPage(vehicles: unknown[]) {
    const payload = vehicles
      .map((v) => JSON.stringify({ vehicle: v }).slice(1, -1)) 
      .map((chunk) => chunk.replace(/\\/g, "\\\\").replace(/"/g, '\\"'))
      .join(",");
    return `<html><body><script>self.__next_f.push([1,"${payload}"])</script></body></html>`;
  }

  it("sayfa 2+ RSC payload'ından araçları çıkarır", () => {
    const listings = parseOtomerkeziListHtml(rscPage([vehicle]));

    expect(listings).toHaveLength(1);
    const listing = listings[0];
    expect(listing.externalId).toBe("2022-renault-express");
    expect(listing.brand).toBe("Renault");
    expect(listing.model).toBe("Express");
    expect(listing.price).toBe(689000);
    expect(listing.mileage).toBe(77000);
    expect(listing.year).toBe(2022);
    expect(listing.features.fuelType).toBe("Dizel");
    expect(listing.features.transmission).toBe("Manuel");
    
    expect(listing.features.bodyType).toBe("Van");
    expect(listing.damageFlag).toBe(false);
    expect(listing.listingUrl).toContain("/ikinci-el/araba/2022-renault-express");
  });

  it("gövde tipini açıklama metninden çıkarır (kaynaktaki 'category' güvenilmez)", () => {
    const cases: [string, string][] = [
      ["2022 model RANGE ROVER SPORT 2.0 P300 HSE SUV. 63.000 KM'de.", "SUV"],
      ["2017 model BMW 118i HATCBACK 1.5 (136) JOY PLUS.", "Hatchback"],
      ["2019 model VW AMAROK 3.0 TDI PICK-UP 4X4.", "Pick-up"],
      ["2020 model MERCEDES E200 SEDAN AMG.", "Sedan"],
      ["2021 model TOYOTA COROLLA 1.8 HYBRID DREAM E-CVT.", "Belirtilmemiş"],
    ];
    for (const [description, expected] of cases) {
      const v = { ...vehicle, slug: `t-${expected}`, description };
      const listings = parseOtomerkeziListHtml(rscPage([v]));
      expect(listings[0].features.bodyType).toBe(expected);
    }
  });

  it("tramer kaydı olan aracı hasarlı işaretler", () => {
    const damaged = { ...vehicle, slug: "hasarli", tramerAmount: 45000 };
    const listings = parseOtomerkeziListHtml(rscPage([damaged]));
    expect(listings[0].damageFlag).toBe(true);
  });

  it("fiyatsız aracı atlar", () => {
    const noPrice = { ...vehicle, pricePerDay: 0 };
    expect(parseOtomerkeziListHtml(rscPage([noPrice]))).toHaveLength(0);
  });
});

describe("parseOtomerkeziListHtml", () => {
  it("ld+json ItemList içinden ilanı doğru alanlarla çıkarır", () => {
    const listings = parseOtomerkeziListHtml(pageWith([sampleItem]));

    expect(listings).toHaveLength(1);
    const listing = listings[0];
    expect(listing.externalId).toBe("2023-volkswagen-polo");
    expect(listing.sourceSite).toBe("otomerkezi");
    expect(listing.brand).toBe("Volkswagen");
    expect(listing.model).toBe("Polo");
    expect(listing.title).toBe("Volkswagen Polo 1.0 Tsi 95 Dsg Life");
    expect(listing.year).toBe(2023);
    expect(listing.price).toBe(1399000);
    expect(listing.mileage).toBe(38985);
    expect(listing.city).toBe("İstanbul");
    expect(listing.features.fuelType).toBe("Benzin");
    expect(listing.features.transmission).toBe("Otomatik");
  });

  it("fiyatı olmayan öğeleri atlar", () => {
    const noPrice = JSON.parse(JSON.stringify(sampleItem));
    delete noPrice.item.offers.price;
    const listings = parseOtomerkeziListHtml(pageWith([sampleItem, noPrice]));
    expect(listings).toHaveLength(1);
  });

  it("CollectionPage ld+json yoksa boş liste döner", () => {
    expect(parseOtomerkeziListHtml("<html><body>bos sayfa</body></html>")).toEqual([]);
  });
});
