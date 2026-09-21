# 协作约定

## 打开链接

给用户游戏链接（本地 `http://127.0.0.1:8080/moba.html`、GitHub Pages 线上地址、PR 链接等）时，**优先用 Microsoft Edge 打开**，不要用内置浏览器。可靠启动方式（用完整 exe 路径，`Start-Process msedge` 的别名形式时灵时不灵）：

```
powershell -NoProfile -Command "Start-Process 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe' -ArgumentList 'http://127.0.0.1:8080/moba.html' -PassThru"
```

启动后必须用 `tasklist | grep msedge.exe` 确认 `msedge.exe` 真的存在（只看到 `msedgewebview2.exe` 说明那是内置浏览器，不是 Edge），别只凭命令返回成功就下结论。

**同时要直接把链接列出来**，不要只打开不写地址。每条链接单独一行、写完整 URL（包括 `http://` 和路径），让用户能直接复制或点击。**初始页面（落地页）链接必须每次都列出来**，游戏、英雄设计图按需附带。本项目常用链接：

- 初始页面（落地页）`http://127.0.0.1:8080/index.html` ← 每次必列
- 游戏 `http://127.0.0.1:8080/moba.html`
- 英雄设计图 `http://127.0.0.1:8080/champions.html`
- GitHub Pages 线上版 `https://microstonedev.github.io/canyon-showdown/`

我能引用的文件路径（如 `moba.html:1074`）不是网页链接，别指望用户点它们能打开浏览器。

## 推送规则

**未经用户明确同意，不得向远端仓库推送任何内容。** 包括：

- `git push`（新分支或已有分支）
- 创建 / 更新 / 合并 / 关闭 Pull Request
- `git push --force` / `--force-with-lease`
- 推送到 GitHub Pages 或任何对外可见的分支

本地操作（`git add`、`git commit`、建分支、rebase 等）可以照常执行，但在执行任何推送类操作前，必须先向用户说明要推送什么、推到哪个分支，并得到同意。

工作方式：完成本地修改后，向用户汇报改动内容和验证结果，等用户说"推送"再执行推送。
