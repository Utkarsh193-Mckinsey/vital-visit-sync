/// <reference types="vite/client" />

// Font file imports with ?url suffix
declare module '*.ttf?url' {
  const src: string;
  export default src;
}

declare module '*.woff?url' {
  const src: string;
  export default src;
}

declare module '*.woff2?url' {
  const src: string;
  export default src;
}
