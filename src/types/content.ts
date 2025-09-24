export type TextContent = {
  text: string;
  type: "text";
};

export type ImageContent = {
  data: string;
  mimeType: string;
  type: "image";
};

export type AudioContent = {
  data: string;
  mimeType: string;
  type: "audio";
};

export type ResourceContent = {
  resource: {
    blob?: string;
    mimeType?: string;
    text?: string;
    uri: string;
  };
  type: "resource";
};

// Forward declaration for ResourceLink - will be resolved when resource types are extracted
export type ResourceLink = any;

export type Content =
  | AudioContent
  | ImageContent
  | ResourceContent
  | ResourceLink
  | TextContent;

export type ContentResult = {
  content: Content[];
  isError?: boolean;
};
