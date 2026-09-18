interface ImportMetaEnv {
  /** Build-time Meta pixel id. Vercel and `.env` provide it; see README section 19. */
  readonly VITE_META_PIXEL_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
