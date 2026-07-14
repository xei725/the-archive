# Photo Corridor 管理说明

## 第一次连接

打开 `gallery-admin.html`，输入仅授权给 `xei725/the-archive` 的 fine-grained GitHub token：

- Resource owner：`xei725`
- Repository access：只选择 `the-archive`
- Repository permissions：`Contents` 设为 `Read and write`

Token 只保存在当前标签页的内存中，关闭标签页后即丢弃，网站不会保存 Token。

## 上传照片

1. 点击 `[ + UPLOAD ]` 并选择 JPEG、PNG、WebP 或 AVIF 图片。
2. 浏览器会把最长边缩小到 1920px，并优先压缩成 WebP；不会把原始大图直接上传。
3. 修改标题、日期、分类、说明、相框和显示形状。
4. 点击 `[ SAVE TO WEBSITE ]`。
5. 状态变成 `PUBLISHED / LIVE` 后，点击 `[ VIEW LATEST ]` 查看线上走廊。

单张原图选择上限为 25MB，优化后的上传文件上限为 5MB。

## 修改与删除

- 选择左侧照片后，可直接修改资料。
- `[ ↑ ]`、`[ ↓ ]` 调整走廊顺序。
- `[ REPLACE IMAGE ]` 替换图片但保留记录。
- `[ DELETE ]` 删除记录；保存后相应图片也会从仓库移除。

所有修改只有在点击 `[ SAVE TO WEBSITE ]` 后才会写入 GitHub。上传前关闭或刷新页面不会留下未发布的文件。
