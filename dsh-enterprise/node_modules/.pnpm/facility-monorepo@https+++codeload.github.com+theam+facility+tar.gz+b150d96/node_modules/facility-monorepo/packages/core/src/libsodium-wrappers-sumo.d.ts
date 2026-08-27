declare module "libsodium-wrappers-sumo" {
  const sodium: {
    ready: Promise<void>;
    crypto_secretbox_KEYBYTES: number;
    crypto_secretbox_NONCEBYTES: number;
    randombytes_buf(length: number): Uint8Array;
    crypto_secretbox_easy(
      message: string | Uint8Array,
      nonce: Uint8Array,
      key: Uint8Array,
    ): Uint8Array;
    crypto_secretbox_open_easy(cipher: Uint8Array, nonce: Uint8Array, key: Uint8Array): Uint8Array;
  };
  export default sodium;
}
