import { theme as antdAlgorithms } from 'ant-design-vue'
import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'

/**
 * Ant Design Vue 主题：白 / 灰 / 黑，不使用红色。
 * 深色模式走 darkAlgorithm，再覆盖品牌与界面色保持中性灰黑。
 */
export function buildAntdTheme(isDark: boolean): ThemeConfig {
  return {
    algorithm: isDark ? [antdAlgorithms.darkAlgorithm] : [],
    token: {
      colorPrimary: isDark ? '#d6d8de' : '#1f2024',
      colorInfo: isDark ? '#d6d8de' : '#1f2024',
      colorSuccess: isDark ? '#6fae8a' : '#4d8a6a',
      colorWarning: isDark ? '#c9a86a' : '#8a6a2f',
      colorError: isDark ? '#8f929b' : '#5b5d64',
      colorLink: isDark ? '#d6d8de' : '#1f2024',
      colorLinkHover: isDark ? '#ffffff' : '#000000',
      colorText: isDark ? '#e8e9ec' : '#17181b',
      colorTextSecondary: isDark ? '#b8bac3' : '#4b4d54',
      colorTextTertiary: isDark ? '#82848d' : '#8b8e96',
      colorTextQuaternary: isDark ? '#5c5e66' : '#b6b8bf',
      colorBorder: isDark ? '#3d3e46' : '#e3e3e7',
      colorBorderSecondary: isDark ? '#2a2b31' : '#f0f0f2',
      colorBgLayout: isDark ? '#151619' : '#ffffff',
      colorBgContainer: isDark ? '#1c1d21' : '#ffffff',
      colorFillAlter: isDark ? '#232429' : '#f7f7f8',
      colorFillSecondary: isDark ? '#24252a' : '#f2f2f4',
      borderRadius: 8,
      borderRadiusLG: 12,
      borderRadiusSM: 6,
      fontFamily:
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif",
      fontSize: 15,
      controlHeight: 36,
      wireframe: false,
      boxShadowSecondary: isDark
        ? '0 10px 30px rgba(0,0,0,0.45)'
        : '0 10px 30px rgba(17,20,28,0.10)',
    },
  }
}
