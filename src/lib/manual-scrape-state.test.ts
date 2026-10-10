import { beforeEach, describe, expect, it, vi } from "vitest";

const stateModel = vi.hoisted(() => ({
  updateOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
}));

vi.mock("@/models/ManualScrapeState", () => ({ ManualScrapeState: stateModel }));

import { ManualScrapeAlreadyRunningError, startManualBeat } from "./manual-scrape-state";

describe("startManualBeat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stateModel.updateOne.mockResolvedValue({ acknowledged: true });
  });

  it("atomically refuses a second live manual scrape", async () => {
    stateModel.findOneAndUpdate.mockResolvedValue(null);

    await expect(startManualBeat("ikinci tarama", "test")).rejects.toBeInstanceOf(ManualScrapeAlreadyRunningError);
    expect(stateModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ key: "manual", $or: expect.any(Array) }),
      expect.objectContaining({ $set: expect.objectContaining({ running: true, label: "ikinci tarama" }) }),
      { new: true }
    );
  });

  it("releases only the lock owned by this request", async () => {
    stateModel.findOneAndUpdate.mockResolvedValue({ _id: "manual" });
    const stop = await startManualBeat("fiyat kontrolü", "test");
    const ownerToken = stateModel.findOneAndUpdate.mock.calls[0][1].$set.ownerToken;

    await stop();

    expect(stateModel.updateOne).toHaveBeenLastCalledWith(
      { key: "manual", ownerToken },
      { $set: expect.objectContaining({ running: false }), $unset: { ownerToken: 1 } }
    );
  });
});
