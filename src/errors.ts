export class StoreBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreBoundaryError";
  }
}

export class StoreConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreConfigError";
  }
}
