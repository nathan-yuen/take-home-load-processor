function log(msg: string): void {
  if (global.debug) {
    console.log(msg);
  }
}

export default { log };
