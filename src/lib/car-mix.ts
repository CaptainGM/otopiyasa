import type { PipelineStage } from "mongoose";


export function mixedSortStages(seed = 0): PipelineStage[] {
  return [
    {
      $setWindowFields: {
        partitionBy: { $concat: [{ $ifNull: ["$brand", ""] }, "|", { $ifNull: ["$model", ""] }] },
        
        sortBy: { _id: -1 },
        output: { segmentRank: { $documentNumber: {} } },
      },
    },
    {
      $addFields: {
        mixKey: {
          $mod: [
            {
              $add: [
                { $toLong: { $ifNull: ["$price", 0] } },
                { $multiply: [{ $toLong: { $ifNull: ["$mileage", 0] } }, 31] },
                seed,
              ],
            },
            9973, 
          ],
        },
      },
    },
    { $sort: { segmentRank: 1, mixKey: 1, _id: 1 } },
    { $unset: ["segmentRank", "mixKey"] },
  ];
}


export function dailyMixSeed(now = Date.now()): number {
  return Math.floor(now / 86_400_000);
}


export function isMixedSort(sort?: string): boolean {
  return !sort || sort === "mixed";
}
