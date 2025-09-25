import { describe, expect, it } from "vitest";
import { imageContent, audioContent } from "../../src/utils/content-helpers.js";

describe("Content Helpers", () => {
  describe("imageContent", () => {
    it("should create image content from buffer", () => {
      const buffer = Buffer.from("fake-image-data");
      const result = imageContent({ buffer });

      expect(result).toEqual({
        type: "image",
        data: "ZmFrZS1pbWFnZS1kYXRh", // base64 encoded
        mimeType: "image/png", // default
      });
    });

    it("should create image content from buffer", async () => {
      const buffer = Buffer.from("fake-image-data");
      const result = await imageContent({ buffer });

      expect(result.type).toBe("image");
      expect(result.data).toBe("ZmFrZS1pbWFnZS1kYXRh"); // base64 encoded
      expect(result.mimeType).toBe("image/png"); // default fallback
    });
  });

  describe("audioContent", () => {
    it("should create audio content from buffer", () => {
      const buffer = Buffer.from("fake-audio-data");
      const result = audioContent({ buffer });

      expect(result).toEqual({
        type: "audio",
        data: "ZmFrZS1hdWRpby1kYXRh", // base64 encoded
        mimeType: "audio/wav", // default
      });
    });

    it("should create audio content from buffer", async () => {
      const buffer = Buffer.from("fake-audio-data");
      const result = await audioContent({ buffer });

      expect(result.type).toBe("audio");
      expect(result.data).toBe("ZmFrZS1hdWRpby1kYXRh"); // base64 encoded
      expect(result.mimeType).toBe("audio/mpeg"); // default fallback
    });
  });
});