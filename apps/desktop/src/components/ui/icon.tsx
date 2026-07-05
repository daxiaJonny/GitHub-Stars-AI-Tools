/**
 * Material Symbols Outlined 图标组件
 * 替代 lucide-react，与 stitch-downloads 设计模板完全一致
 *
 * 用法: <Icon name="star" size={20} fill className="text-primary" />
 * 图标名参考: https://fonts.google.com/icons
 */

import { CSSProperties } from 'react';

type IconProps = {
  /** Material Symbols 图标名，如 "star"、"dashboard"、"hub" */
  name: string;
  /** 尺寸（px），默认 24 */
  size?: number;
  /** 是否填充图标（FILL 1），默认非填充 */
  fill?: boolean;
  /** 额外 className */
  className?: string;
  /** 内联样式 */
  style?: CSSProperties;
  /** 点击回调 */
  onClick?: () => void;
  /** 旋转角度（度） */
  rotate?: number;
};

export function Icon({ name, size = 24, fill = false, className, style, onClick, rotate }: IconProps) {
  const variationSettings: Record<string, string | number> = {
    FILL: fill ? 1 : 0,
  };
  if (rotate) {
    variationSettings['GRADATION'] = 0;
  }

  return (
    <span
      className={`material-symbols-outlined ${className ?? ''}`}
      style={{
        fontSize: `${size}px`,
        fontVariationSettings: Object.entries(variationSettings)
          .map(([k, v]) => `'${k}' ${v}`)
          .join(', '),
        cursor: onClick ? 'pointer' : 'inherit',
        ...style,
      }}
      onClick={onClick}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
