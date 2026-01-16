import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // 允許搜尋引擎爬蟲，但阻擋登入後頁面
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/insights',
          '/posts',
          '/compose',
          '/scheduled',
          '/tags',
          '/reports',
          '/settings',
          '/admin',
          '/api',
          '/auth',
        ],
      },
      // 阻擋 AI 訓練爬蟲
      {
        userAgent: 'GPTBot',
        disallow: '/',
      },
      {
        userAgent: 'ChatGPT-User',
        disallow: '/',
      },
      {
        userAgent: 'Google-Extended',
        disallow: '/',
      },
      {
        userAgent: 'CCBot',
        disallow: '/',
      },
      {
        userAgent: 'anthropic-ai',
        disallow: '/',
      },
      {
        userAgent: 'Claude-Web',
        disallow: '/',
      },
      {
        userAgent: 'Bytespider',
        disallow: '/',
      },
      {
        userAgent: 'cohere-ai',
        disallow: '/',
      },
    ],
    sitemap: 'https://postlyzer.metricdesk.io/sitemap.xml',
  };
}
