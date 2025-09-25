export { handleHealthEndpoint } from "./health-endpoint.js";
export type { HealthConfig, HealthEndpointConfig } from "./health-endpoint.js";

export { handleOAuthEndpoints } from "./oauth-endpoints.js";
export type { OAuthConfig, OAuthEndpointConfig } from "./oauth-endpoints.js";

export { handleReadinessEndpoint } from "./readiness-endpoint.js";
export type {
  ReadinessEndpointConfig,
  ReadinessResponse,
  ReadinessSession,
} from "./readiness-endpoint.js";
