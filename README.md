# Hikari Mori — 日系摄影师作品集

编辑排版风格（参考 Reform Collective）× 日式留白、和纸底色、朱色点缀、竖排日文。

## 运行

```bash
npm install      # 首次运行
npm start        # 打开 http://localhost:3000
```

或者直接双击 `start.bat`。

- 网站首页：http://localhost:3000
- 管理后台：http://localhost:3000/admin.html（默认密码 `hikari`）

修改密码 / 端口（PowerShell）：

```powershell
$env:ADMIN_PASSWORD="你的密码"; $env:PORT=8080; npm start
```

## 功能

| 模块 | 说明 |
| --- | --- |
| 个人作品（Works） | 参考 madewithgsap tutorial111：横向画廊，中间一张放大、两侧图片被推开并变为黑白；可拖拽（带惯性）、左右按钮、键盘 ← →、自动播放；标题在两个文字状态之间滚动切换；点击中间图片打开大图。 |
| 灵感图集（Inspiration） | 参考 madewithgsap effect119（Push Away Gallery）：图片保持原始比例错落排列；点击后放大到屏幕中央，其余图片沿各自方向被推离点击点，下方显示说明文字；再次点击 / Esc / 滚动即复原。 |
| 管理后台 | 登录后上传（拖拽或多选，带进度条）、编辑标题/地点/年份/说明、拖动排序、删除。作品列表第一张同时作为首页大图。 |

首次启动会写入几张来自 picsum.photos 的「示例」图片，在后台删除即可。

## 目录

```
server.js            Express 服务：静态文件、上传（multer）、JSON 数据
data/db.json         作品与灵感图集的元数据（自动生成）
uploads/             上传的原图
public/index.html    网站首页
public/admin.html    管理后台
public/js/works.js   作品画廊效果
public/js/inspiration.js  灵感图集效果
public/js/main.js    加载动画、平滑滚动、菜单、滚动动画
```

自定义个人信息（名字、简介、邮箱、社交链接等）请直接编辑 `public/index.html`。

> 备份内容时，复制 `data/` 和 `uploads/` 两个文件夹即可。
