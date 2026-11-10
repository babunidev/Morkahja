import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import {
  SOCIAL_DESCRIPTION,
  SOCIAL_IMAGE_HEIGHT,
  SOCIAL_IMAGE_PATH,
  SOCIAL_IMAGE_TYPE,
  SOCIAL_IMAGE_WIDTH,
  SOCIAL_SITE_URL_FALLBACK,
  SOCIAL_TITLE,
} from './socialPreview'

const clientDir = path.dirname(fileURLToPath(import.meta.url))

/**
 * Production deployment: https://www.babuni.dev/Morkahja/ (see docs/DEPLOYMENT.md).
 * The reverse proxy strips `/Morkahja/api` before forwarding to Express, which
 * keeps registering its routes at the root (`/health`, `/session`, ...).
 */
const PRODUCTION_BASE_PATH = '/Morkahja/'
const LOCAL_API_TARGET = 'http://127.0.0.1:3000'

function normalizeBasePath(value: string): string {
  const withLeading = value.startsWith('/') ? value : `/${value}`
  return withLeading.endsWith('/') ? withLeading : `${withLeading}/`
}

function escapeHtmlAttr(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function socialPreviewPlugin(siteUrl: string, mode: string): Plugin {
  return {
    name: 'morkahja-social-preview',
    transformIndexHtml(html) {
      const base = siteUrl.replace(/\/+$/, '')
      const image = `${base}${SOCIAL_IMAGE_PATH}`
      const meta = [
        `<meta name="description" content="${escapeHtmlAttr(SOCIAL_DESCRIPTION)}" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:site_name" content="${escapeHtmlAttr(SOCIAL_TITLE)}" />`,
        `<meta property="og:title" content="${escapeHtmlAttr(SOCIAL_TITLE)}" />`,
        `<meta property="og:description" content="${escapeHtmlAttr(SOCIAL_DESCRIPTION)}" />`,
        `<meta property="og:url" content="${base}/" />`,
        `<meta property="og:image" content="${image}" />`,
        `<meta property="og:image:type" content="${SOCIAL_IMAGE_TYPE}" />`,
        `<meta property="og:image:width" content="${SOCIAL_IMAGE_WIDTH}" />`,
        `<meta property="og:image:height" content="${SOCIAL_IMAGE_HEIGHT}" />`,
        `<meta property="og:image:alt" content="${escapeHtmlAttr(SOCIAL_TITLE)}" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${escapeHtmlAttr(SOCIAL_TITLE)}" />`,
        `<meta name="twitter:description" content="${escapeHtmlAttr(SOCIAL_DESCRIPTION)}" />`,
        `<meta name="twitter:image" content="${image}" />`,
      ].join('\n    ')

      if (mode === 'production' && siteUrl === SOCIAL_SITE_URL_FALLBACK) {
        console.warn(
          '[morkahja] Link previews use SOCIAL_SITE_URL_FALLBACK. Set VITE_SITE_URL at build time if your public URL differs.',
        )
      }

      return html.replace('<!-- social-preview -->', meta)
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, clientDir, '')
  const isProduction = mode === 'production'
  // Development keeps serving from `/`; production builds and `vite preview` use the subpath.
  const base = normalizeBasePath(
    env.VITE_BASE_PATH?.trim() || (isProduction ? PRODUCTION_BASE_PATH : '/'),
  )
  // An explicit VITE_API_BASE_URL (including an empty string) always wins.
  const apiBaseUrl =
    env.VITE_API_BASE_URL ?? (isProduction && base !== '/' ? `${base}api` : '')
  const apiProxy =
    apiBaseUrl.startsWith('/') && apiBaseUrl.length > 1
      ? {
          [apiBaseUrl]: {
            target: LOCAL_API_TARGET,
            rewrite: (requestPath: string) =>
              requestPath.slice(apiBaseUrl.length) || '/',
          },
        }
      : {}
  const siteUrl =
    env.VITE_SITE_URL?.trim() ||
    (mode === 'production' ? SOCIAL_SITE_URL_FALLBACK : '')

  return {
    base,
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBaseUrl),
    },
    plugins: [
      react(),
      ...(siteUrl ? [socialPreviewPlugin(siteUrl, mode)] : []),
    ],
    resolve: {
      alias: {
        '@shared': path.resolve(clientDir, '../shared/src'),
      },
    },
    server: {
      proxy: {
        ...apiProxy,
        '/activity': 'http://127.0.0.1:3000',
        '/encounter': 'http://127.0.0.1:3000',
        '/room': 'http://127.0.0.1:3000',
        '/session': 'http://127.0.0.1:3000',
        '/player': 'http://127.0.0.1:3000',
        '/avatar': 'http://127.0.0.1:3000',
        '/avatars': 'http://127.0.0.1:3000',
        '/game-data': 'http://127.0.0.1:3000',
        '/health': 'http://127.0.0.1:3000',
      },
    },
    // Local subpath check: `npm run build && npm run preview` serves /Morkahja/
    // and forwards /Morkahja/api/* to the local backend with the prefix stripped.
    preview: {
      proxy: apiProxy,
    },
  }
})
