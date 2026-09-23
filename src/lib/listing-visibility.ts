
export const PUBLIC_LISTING_FILTER = {
  status: "active",
  moderationStatus: { $nin: ["pending", "rejected"] },
} as const;
