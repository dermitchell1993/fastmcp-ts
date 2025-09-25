/**
 * FastMCP Content Helper Functions
 * 
 * Utilities for processing image and audio content from various sources.
 */

import { readFile } from "fs/promises";

/**
 * Image content type definition
 */
export type ImageContent = {
  data: string;
  mimeType: string;
  type: "image";
};

/**
 * Audio content type definition
 */
export type AudioContent = {
  data: string;
  mimeType: string;
  type: "audio";
};

/**
 * Text content type definition
 */
export type TextContent = {
  text: string;
  type: "text";
};

/**
 * Process image content from buffer, file path, or URL
 */
export const imageContent = async (
  input: { buffer: Buffer } | { path: string } | { url: string },
): Promise<ImageContent> => {
  let rawData: Buffer;

  try {
    if ("url" in input) {
      try {
        const response = await fetch(input.url);

        if (!response.ok) {
          throw new Error(
            `Server responded with status: ${response.status} - ${response.statusText}`,
          );
        }

        rawData = Buffer.from(await response.arrayBuffer());
      } catch (error) {
        throw new Error(
          `Failed to fetch image from URL (${input.url}): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } else if ("path" in input) {
      try {
        rawData = await readFile(input.path);
      } catch (error) {
        throw new Error(
          `Failed to read image from path (${input.path}): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } else if ("buffer" in input) {
      rawData = input.buffer;
    } else {
      throw new Error(
        "Invalid input: Provide a valid 'url', 'path', or 'buffer'",
      );
    }

    const { fileTypeFromBuffer } = await import("file-type");
    const mimeType = await fileTypeFromBuffer(rawData);

    if (!mimeType || !mimeType.mime.startsWith("image/")) {
      console.warn(
        `Warning: Content may not be a valid image. Detected MIME: ${
          mimeType?.mime || "unknown"
        }`,
      );
    }

    const base64Data = rawData.toString("base64");

    return {
      data: base64Data,
      mimeType: mimeType?.mime ?? "image/png",
      type: "image",
    } as const;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(`Unexpected error processing image: ${String(error)}`);
    }
  }
};

/**
 * Process audio content from buffer, file path, or URL
 */
export const audioContent = async (
  input: { buffer: Buffer } | { path: string } | { url: string },
): Promise<AudioContent> => {
  let rawData: Buffer;

  try {
    if ("url" in input) {
      try {
        const response = await fetch(input.url);

        if (!response.ok) {
          throw new Error(
            `Server responded with status: ${response.status} - ${response.statusText}`,
          );
        }

        rawData = Buffer.from(await response.arrayBuffer());
      } catch (error) {
        throw new Error(
          `Failed to fetch audio from URL (${input.url}): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } else if ("path" in input) {
      try {
        rawData = await readFile(input.path);
      } catch (error) {
        throw new Error(
          `Failed to read audio from path (${input.path}): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    } else if ("buffer" in input) {
      rawData = input.buffer;
    } else {
      throw new Error(
        "Invalid input: Provide a valid 'url', 'path', or 'buffer'",
      );
    }

    const { fileTypeFromBuffer } = await import("file-type");
    const mimeType = await fileTypeFromBuffer(rawData);

    if (!mimeType || !mimeType.mime.startsWith("audio/")) {
      console.warn(
        `Warning: Content may not be a valid audio file. Detected MIME: ${
          mimeType?.mime || "unknown"
        }`,
      );
    }

    const base64Data = rawData.toString("base64");

    return {
      data: base64Data,
      mimeType: mimeType?.mime ?? "audio/mpeg",
      type: "audio",
    } as const;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error(`Unexpected error processing audio: ${String(error)}`);
    }
  }
};
