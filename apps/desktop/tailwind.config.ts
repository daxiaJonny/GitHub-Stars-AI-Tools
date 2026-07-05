import type { Config } from 'tailwindcss';

// Tailwind v4 主要通过 styles.css 的 @theme 块定义主题
// 此文件仅保留 v3 兼容所需的最小配置
const config = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;
