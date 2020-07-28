export {};

declare global {
  module NodeJS {
    interface Global {
      debug: boolean;
    }
  }
}
