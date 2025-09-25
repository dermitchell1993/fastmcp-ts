/**
 * FastMCP Error Classes
 *
 * Base error classes for FastMCP framework with inheritance hierarchy.
 */

/**
 * Base error class for all FastMCP errors
 */
export class FastMCPError extends Error {
  constructor(message) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Error indicating an unexpected state in the application
 */
export class UnexpectedStateError extends FastMCPError {
  constructor(message, extras) {
    super(message);
    this.name = new.target.name;
    this.extras = extras;
  }
}

/**
 * An error that is meant to be surfaced to the user.
 */
export class UserError extends UnexpectedStateError {}
