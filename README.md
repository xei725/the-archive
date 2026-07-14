# The Archive

The Archive 是一个长期成长的个人数字空间。当前实现保持零构建、零第三方依赖，只使用原生 HTML、CSS 和 JavaScript。

## Phase 1 当前状态

- Archive Hall 已重构为中式千禧年私人电脑房。
- Library、Studio、Gallery、Journal 四个入口已经预留。
- Library 已连接现有 EZ Library；其余三个入口会明确显示正在准备中。
- 本地时间和日期是真实数据，每秒更新。
- 天气系统只保留真实数据接口；未接入提供方时显示 NOT CONNECTED，不制造虚假天气。
- 房间悬停、键盘焦点和进入转场已经完成。
- 环境声由浏览器本地生成，默认关闭，不需要音频文件。
- 桌面、平板和移动端都提供可用导航。

## 本地打开

可以直接打开 index.html。

如需用本地服务器验证：

    python -m http.server 4173

然后访问 http://127.0.0.1:4173 。

## 天气提供方接口

在 environment.js 执行前设置 window.ArchiveWeatherProvider。它可以是异步函数，也可以是带 getCurrent 方法的对象，返回：

    {
      condition: "cloudy",
      temperature: 24,
      unit: "C",
      location: "Shanghai"
    }

支持的基础状态包括 clear、cloudy、rain、storm、snow 和 fog。后续接入天气 API 时，不需要修改大厅交互代码。

## 主要文件

- index.html：大厅语义结构和四个入口。
- styles.css：场景、入口、转场和响应式布局。
- environment.js：时间系统和天气提供方接口。
- script.js：房间交互、转场和本地环境声。
- assets/images/archive-hall-room.png：大厅生产背景。
- design/archive-hall-concept.png：本阶段视觉概念。
- design/archive-hall-spec.md：设计系统和可见文案锁定。

Library、文件夹页和本地管理页继续沿用现有文件，不受本次首页重构影响。
