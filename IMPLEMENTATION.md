# 项目实现总结

## 已完成功能

### P0 核心功能 ✅

1. **合集管理** (`pages/index/`)
   - 新建合集
   - 合集列表展示
   - 长按删除/重命名
   - 缓存策略

2. **时间线** (`pages/collection/`)
   - 按时间倒序展示记录
   - 添加记录（拍照/相册）
   - 对位再拍入口
   - 对比模式入口

3. **相机** (`pages/camera/`)
   - 普通拍摄模式
   - 对位拍摄模式（半透明参考层）
   - 透明度调节
   - 取景框辅助线

4. **记录确认** (`pages/record/`)
   - 照片预览
   - 水印开关和预览
   - 备注输入
   - 日期选择
   - 图片压缩和水印合成
   - 上传到 S3

5. **对比模式** (`pages/compare/`)
   - 按对位组分组
   - 横向滚动画廊
   - 按时间排序

6. **设置** (`pages/settings/`)
   - 导出备份
   - 清空缓存
   - 使用说明

### 工具模块

- `utils/s3.js` - S3 存储封装（预签名 URL、上传、下载）
- `utils/image.js` - 图片压缩、缩略图、水印合成
- `utils/collection.js` - 合集管理、ID 生成、时间线操作

### 云函数

- `cloudfunctions/getPresignedUrl/` - 生成 S3 预签名 URL

## 项目结构

```
TimeLine/
├── miniprogram/
│   ├── app.js              # 入口
│   ├── app.json            # 全局配置
│   ├── app.wxss            # 全局样式
│   ├── sitemap.json
│   ├── utils/
│   │   ├── s3.js           # S3 封装
│   │   ├── image.js        # 图片处理
│   │   └── collection.js   # 合集管理
│   ├── pages/
│   │   ├── index/          # 合集列表
│   │   ├── collection/     # 合集详情/时间线
│   │   ├── camera/         # 相机
│   │   ├── record/         # 记录确认
│   │   ├── compare/        # 对比模式
│   │   └── settings/       # 设置
│   └── images/             # 图标资源
├── cloudfunctions/
│   └── getPresignedUrl/    # 云函数
├── project.config.json
├── package.json
├── README.md
├── DEPLOY.md               # 部署指南
└── doc.md                  # 需求文档
```

## 需要配置的内容

1. **小程序 AppID** - 在 `project.config.json` 中配置
2. **云开发环境 ID** - 在 `app.js` 中配置
3. **S3 AccessKey** - 在云函数环境变量中配置
   - `CST_AK` - AccessKeyId
   - `CST_SK` - SecretAccessKey
   - `CST_BUCKET` - 桶名

4. **TabBar 图标** - 在 `miniprogram/images/` 中添加
   - `tab-home.png`
   - `tab-home-active.png`
   - `tab-settings.png`
   - `tab-settings-active.png`

## 数据模型

### _manifest.json
```json
{
  "version": 1,
  "updatedAt": "2026-11-12T10:00:00Z",
  "collections": [
    {
      "id": "col_20261112103000_a3f2",
      "name": "龟背竹",
      "coverKey": "collections/col_001/thumbs/rec_xxx.jpg",
      "recordCount": 24,
      "lastRecordAt": "2026-11-10T08:30:00Z"
    }
  ]
}
```

### timeline.json
```json
{
  "collectionId": "col_001",
  "name": "龟背竹",
  "updatedAt": "2026-11-10T08:30:00Z",
  "records": [
    {
      "id": "rec_20261110083000_7b1",
      "capturedAt": "2026-11-10T08:30:00Z",
      "mediaKey": "collections/col_001/media/rec_xxx.jpg",
      "thumbKey": "collections/col_001/thumbs/rec_xxx.jpg",
      "note": "第三片新叶完全展开",
      "alignGroupId": "ag_leaf_03",
      "referenceRecordId": "rec_20261103080000_2c9",
      "watermark": {
        "dateText": "2026-11-10",
        "collectionName": "龟背竹",
        "seq": 24,
        "enabled": true
      }
    }
  ]
}
```

## 下一步

1. 添加 TabBar 图标
2. 配置云开发环境
3. 配置 S3 AccessKey
4. 上传云函数
5. 编译测试

## 注意事项

1. **S3 User-Agent** - 必须使用 `rclone/v1.68.0`
2. **ForcePathStyle** - S3 请求必须启用
3. **预签名 URL 有效期** - PUT 900s / GET 3600s
4. **图片压缩** - 主图 1080px/75 质量，缩略图 300px/60 质量
5. **水印合成** - 客户端 Canvas 合成，右下角边距 3%
