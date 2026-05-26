import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import {
  SOCIAL_DESCRIPTION,
  SOCIAL_IMAGE_HEIGHT,
  SOCIAL_IMAGE_PATH,
  SOCIAL_IMAGE_WIDTH,
  SOCIAL_SITE_URL_FALLBACK,
  SOCIAL_TITLE,
} from './socialPreview'

const clientDir = path.dirname(fileURLToPath(import.meta.url))

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
        `<meta property="og:image:type" content="image/png" />`,
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
  const siteUrl =
    env.VITE_SITE_URL?.trim() ||
    (mode === 'production' ? SOCIAL_SITE_URL_FALLBACK : '')

  return {
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
  }
})
