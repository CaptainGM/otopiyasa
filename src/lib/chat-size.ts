

export const MIN_CHAT_SIZE = { w: 300, h: 320 };

export const MAX_CHAT_WIDTH = 680;

export const DEFAULT_CHAT_SIZE = { w: 372, h: 520 };


export const CHAT_MARGIN = { w: 40, h: 104 };

export interface ChatSize {
  w: number;
  h: number;
}

export function availableChatSize(
  viewportWidth: number,
  viewportHeight: number
): ChatSize {
  return {
    w: Math.max(MIN_CHAT_SIZE.w, viewportWidth - CHAT_MARGIN.w),
    h: Math.max(MIN_CHAT_SIZE.h, viewportHeight - CHAT_MARGIN.h),
  };
}


export function clampChatSize(w: number, h: number, available: ChatSize): ChatSize {
  return {
    w: Math.min(Math.max(w, MIN_CHAT_SIZE.w), Math.min(MAX_CHAT_WIDTH, available.w)),
    h: Math.min(Math.max(h, MIN_CHAT_SIZE.h), available.h),
  };
}
