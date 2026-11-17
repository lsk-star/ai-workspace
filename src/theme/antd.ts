import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context'

/**
 * Ant Design Vue 主题：白 / 灰 / 黑，不使用红色。
 */
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1f2024',
    colorInfo: '#1f2024',
    colorSuccess: '#4d8a6a',
    colorWarning: '#8a6a2f',
    colorError: '#5b5d64',
    colorLink: '#1f2024',
    colorLinkHover: '#000000',
    colorText: '#17181b',
    colorTextSecondary: '#4b4d54',
    colorTextTertiary: '#8b8e96',
    colorTextQuaternary: '#b6b8bf',
    colorBorder: '#e3e3e7',
    colorBorderSecondary: '#f0f0f2',
    colorBgLayout: '#ffffff',
    colorBgContainer: '#ffffff',
    colorFillAlter: '#f7f7f8',
    colorFillSecondary: '#f2f2f4',
    borderRadius: 8,
    borderRadiusLG: 12,
    borderRadiusSM: 6,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif",
    fontSize: 15,
    controlHeight: 36,
    wireframe: false,
    boxShadowSecondary: '0 10px 30px rgba(17,20,28,0.10)',
  },
}
