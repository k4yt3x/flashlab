/** What the build stamps in, from `define` in `vite.config.ts`. */
interface ImportMetaEnv {
  /** The `package.json` version this was built from. */
  readonly VITE_VERSION?: string;
  /** The short commit hash, or absent where the build had no repository to ask. */
  readonly VITE_COMMIT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
