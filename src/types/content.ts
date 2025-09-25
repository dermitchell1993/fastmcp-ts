export type AudioContent = {
  data: string;
  mimeType: string;
  type: "audio";
};

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

export type ImageContent = {
  data: string;
  mimeType: string;
  type: "image";
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

// ResourceLink for referencing resources without embedding content
export type ResourceLink = {
  resource: {
    uri: string;
  };
  type: "resource_link";
};

export type TextContent = {
  text: string;
  type: "text";
};
