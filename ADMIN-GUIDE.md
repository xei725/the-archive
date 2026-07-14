# EZ Library 管理说明

## GitHub Token 设置

打开 `admin.html`，使用 fine-grained personal access token 登录。Token 必须满足：

- Resource owner：`xei725`
- Repository access：`Only select repositories`，选择 `the-archive`
- Repository permissions：`Contents` 设置为 `Read and write`

不需要 Actions 权限。Token 仅保存在当前浏览器标签页的内存里，关闭标签页后即丢弃。

如果页面显示 `TOKEN HAS NO WRITE ACCESS`，说明 Token 没有选中仓库或 Contents 不是读写权限；重新创建一个符合上述配置的 Token 即可。

## 管理内容

1. 点击 `[ + ]` 创建文件夹。
2. 修改 `FOLDER TITLE` 和显示行；左侧目录会立即更新。
3. 使用 `[ + TEXT ]` 添加文字、`[ + LINK ]` 添加链接、`[ + FILE ]` 上传文件。
4. 修改或删除内容后，点击 `[ SAVE TO WEBSITE ]`。
5. GitHub Pages 部署完成后，普通访客会在 `library.html` 看到更新。

单个上传文件上限为 5 MB。访客页面不加载管理脚本，且没有有效 GitHub Token 时管理页无法写入仓库。
