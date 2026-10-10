// Verified 2026-10-10: the team's copy matches the upstream GGUF byte for byte, and Hugging Face
// reports the same size and SHA-256 (X-Linked-Size, X-Linked-ETag) for `url`.
// https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF
export const BUNDLED_MODEL = {
  file_name: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
  size: 807694464,
  sha256: '6f85a640a97cf2bf5b8e764087b1e83da0fdb51d7c9fab7d0fece9385611df83',
  // Settings > "I-download ang AI": the one request outside the pinned update host (AGENTS rule 1).
  url: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
} as const;
