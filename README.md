# The Archive

The Archive 是一个长期成长的个人数字空间。当前实现保持零构建、零第三方依赖，只使用原生 HTML、CSS 和 JavaScript。

## Phase 1 当前状态

- Archive Hall 已重构为中式千禧年私人电脑房。
- Library、Studio、Gallery、Journal 四个入口已经预留。
- Library 已连接现有 EZ Library；其余三个入口会明确显示正在准备中。
- 本地时间和日期是真实数据，每秒更新。
- 访客主动授权定位后，天气系统显示真实城市、天气、温度与昼夜状态，并每 15 分钟刷新。
- 晴天、阴天、雾、雨、雷暴和雪会改变大厅光照与窗外动画；不随机生成天气。
- 房间悬停、键盘焦点和进入转场已经完成。
- 氛围音乐、室内底噪和天气环境声由浏览器本地生成，默认关闭，由访客控制。
- 桌面、平板和移动端都提供可用导航。

## 本地打开

可以直接打开 index.html。

如需用本地服务器验证：

    python -m http.server 4173

然后访问 http://127.0.0.1:4173 。

## 天气与地区

`weather-provider.js` 使用两个免密钥接口：

- Open-Meteo Forecast API：当前温度、天气代码、降水、云量、风速和昼夜状态。
- BigDataCloud Client-side Reverse Geocoding API：把浏览器授权得到的坐标转换为城市/地区名称。

首次访问不会自动请求位置。访客点击 `USE MY LOCATION` 并授权后才会连接；坐标降至三位小数后保存在当前浏览器的 localStorage，方便下次自动刷新。拒绝授权或接口不可用时会明确显示降级状态。

天气状态统一为 `clear`、`cloudy`、`rain`、`storm`、`snow` 和 `fog`，环境效果由 `styles.css` 中的 `data-weather` / `data-solar` 规则控制。

## 音频配置

当前版本没有外部音频文件，也不会触发自动播放。`audio-system.js` 使用 Web Audio API 生成：

- 缓慢变化的四组氛围和弦；
- 低音量室内电流/房间底噪；
- 根据真实天气增减的雨声层。

音量和节奏在 `audio-system.js` 顶部 `DEFAULTS` 中调整：`masterVolume`、`chordSeconds`、`fadeSeconds`。和弦频率在同文件的 `CHORDS` 中调整。

## 主要文件

- index.html：大厅语义结构和四个入口。
- styles.css：场景、入口、转场和响应式布局。
- weather-provider.js：定位、城市反向地理编码和 Open-Meteo 实时天气。
- environment.js：时间、天气状态和自动刷新协调。
- audio-system.js：氛围音乐、室内底噪和天气环境声。
- script.js：房间交互、转场、定位按钮和声音按钮。
- assets/images/archive-hall-room.png：大厅生产背景。
- design/archive-hall-concept.png：本阶段视觉概念。
- design/archive-hall-spec.md：设计系统和可见文案锁定。

Library、文件夹页和本地管理页继续沿用现有文件，不受本次首页重构影响。
