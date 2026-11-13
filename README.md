# 植物成长时间线记录小程序

## 项目结构
```
miniprogram/
├── app.js              # 小程序入口
├── app.json            # 全局配置
├── app.wxss            # 全局样式
├── utils/
│   ├── s3.js           # S3 存储封装
│   ├── storage.js      # 本地缓存管理
│   └── image.js        # 图片压缩和水印
├── pages/
│   ├── index/          # 合集列表页
│   ├── collection/     # 合集详情页
│   ├── camera/         # 相机页
│   ├── record/         # 记录确认页
│   ├── compare/        # 对比模式页
│   └── settings/       # 设置页
└── components/         # 公共组件

cloudfunctions/
└── getPresignedUrl/    # 云函数：获取预签名 URL
```

## 开发说明
1. 使用微信开发者工具打开
2. 配置云开发环境 ID
3. 配置 S3 环境变量（CST_AK, CST_SK, CST_BUCKET）
4. 上传云函数
5. 编译运行

## 数据存储
- 中科院数据胶囊 S3: https://s3.cstcloud.cn
- 云函数获取预签名 URL
- 小程序端直接 PUT/GET
