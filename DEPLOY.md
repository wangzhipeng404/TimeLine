# 部署指南

## 1. 准备工作

### 1.1 微信开发者工具
1. 下载并安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 注册微信小程序账号（自用可选择个人类型）
3. 获取 AppID（测试阶段可使用测试号）

### 1.2 云开发环境
1. 在微信开发者工具中打开项目
2. 点击「云开发」按钮
3. 创建云开发环境（免费版即可）
4. 记录环境 ID，用于配置 `app.json`

### 1.3 中科院数据胶囊
1. 访问 https://s3.cstcloud.cn
2. 创建 AccessKey（AK/SK）
3. 创建存储桶（bucket），命名为 `timeline`
4. 记录 AK、SK、桶名

## 2. 项目配置

### 2.1 修改 project.config.json
```json
{
  "appid": "你的小程序 AppID",
  "cloudfunctionRoot": "cloudfunctions/"
}
```

### 2.2 修改 app.json
```json
{
  "cloud": true
}
```

### 2.3 修改 app.js
```javascript
// 初始化云开发
wx.cloud.init({
  env: '你的云开发环境 ID',  // 替换为你的环境 ID
  traceUser: false
})
```

### 2.4 配置云函数环境变量
在 `cloudfunctions/getPresignedUrl/package.json` 中修改：
```json
{
  "envVariables": {
    "CST_AK": "你的 AccessKeyId",
    "CST_SK": "你的 SecretAccessKey",
    "CST_BUCKET": "timeline"
  }
}
```

或者在微信开发者工具中：
1. 右键点击 `getPresignedUrl` 云函数
2. 选择「设置云函数环境变量」
3. 添加上述环境变量

## 3. 上传云函数

1. 在微信开发者工具中，右键点击 `cloudfunctions/getPresignedUrl`
2. 选择「当前环境」
3. 右键点击文件夹，选择「上传并部署：云端安装依赖」
4. 等待上传完成

## 4. 配置权限

### 4.1 小程序后台配置
在微信公众平台：
1. 开发 -> 开发管理 -> 开发设置
2. 添加服务器域名：`https://s3.cstcloud.cn`
3. 保存

### 4.2 权限配置
在 `app.json` 中已配置相机和相册权限：
```json
{
  "permission": {
    "scope.camera": {
      "desc": "用于拍摄植物成长照片"
    },
    "scope.writePhotosAlbum": {
      "desc": "用于保存照片到相册"
    }
  }
}
```

## 5. 编译运行

1. 点击「编译」按钮
2. 选择「真机预览」或「真机调试」
3. 扫码体验

## 6. 数据胶囊 S3 配置说明

### 6.1 访问密钥绑定
确保 AccessKey 与正确的「应用」绑定，请求时需携带匹配的 `User-Agent`。
本项目统一使用 `rclone/v1.68.0`。

### 6.2 存储桶策略
建议设置桶策略为私有，仅通过预签名 URL 访问。

### 6.3 数据备份
定期使用小程序内的「导出备份」功能导出 JSON 数据。

## 7. 常见问题

### Q1: 上传失败 403
- 检查 AccessKey 是否正确
- 检查 User-Agent 是否与 AK 绑定应用一致
- 使用 curl 验证：`curl -v -X PUT -H "User-Agent: rclone/v1.68.0" ...`

### Q2: 云函数调用失败
- 检查云函数是否上传成功
- 检查环境变量是否正确配置
- 查看云函数日志

### Q3: 图片压缩效果差
- 调整 `utils/image.js` 中的压缩参数
- 增加 `quality` 值或 `maxWidth`

### Q4: 小程序无法访问 S3
- 检查服务器域名是否配置
- 检查网络权限

## 8. 数据结构

```
timeline/
├── _manifest.json              # 合集索引
└── collections/
    ├── {collectionId}/
    │   ├── meta.json           # 合集元数据
    │   ├── timeline.json       # 时间线数据
    │   ├── media/              # 原图
    │   │   └── {recordId}.jpg
    │   └── thumbs/             # 缩略图
    │       └── {recordId}.jpg
```

## 9. 更新日志

### v1.0.0
- 合集管理（创建/删除/重命名）
- 时间线记录（拍照/相册选择）
- 对位拍摄
- 水印合成
- 对比模式
- 数据导出备份
