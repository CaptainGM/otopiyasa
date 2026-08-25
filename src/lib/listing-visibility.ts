
export const PUBLIC_LISTING_FILTER = {
  moderationStatus: { $nin: ["pending", "rejected"] },
  
  status: { $nin: ["sold", "removed"] },
} as const;
