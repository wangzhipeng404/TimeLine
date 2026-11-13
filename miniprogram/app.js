// app.js
App({
  globalData: {
    manifest: null,
    manifestUpdatedAt: null,
    isOnline: true
  },

  onLaunch() {
    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({
        env: 'timeline-d1gxplbxh1e5ee754', // 替换为你的云开发环境 ID
        traceUser: false
      })
    }

    // 检查网络状态
    this.checkNetwork()

    // 启动时加载 manifest
    this.loadManifest()
  },

  checkNetwork() {
    const networkType = wx.getNetworkType()
    this.globalData.isOnline = networkType.networkType !== 'none'
  },

  async loadManifest() {
    try {
      // 先尝试从缓存读取
      const cached = wx.getStorageSync('manifest')
      if (cached) {
        this.globalData.manifest = cached.manifest
        this.globalData.manifestUpdatedAt = cached.updatedAt
      }

      // 后台拉取最新
      await this.refreshManifest()
    } catch (err) {
      console.error('加载 manifest 失败:', err)
    }
  },

  async refreshManifest() {
    try {
      const s3 = require('./utils/s3')
      const data = await s3.loadJson('_manifest.json')
      if (data) {
        this.globalData.manifest = data
        this.globalData.manifestUpdatedAt = Date.now()
        wx.setStorageSync('manifest', {
          manifest: data,
          updatedAt: this.globalData.manifestUpdatedAt
        })
      } else if (!s3.isS3Enabled()) {
        // S3 未启用，使用空结构
        this.globalData.manifest = { collections: [] }
      }
    } catch (err) {
      console.error('刷新 manifest 失败:', err)
      this.globalData.isOnline = false
    }
  },

  getManifest() {
    return this.globalData.manifest || { collections: [] }
  },

  async saveManifest(manifest) {
    try {
      const s3 = require('./utils/s3')
      manifest.updatedAt = new Date().toISOString()
      await s3.saveJson('_manifest.json', manifest)
      this.globalData.manifest = manifest
      this.globalData.manifestUpdatedAt = Date.now()
      wx.setStorageSync('manifest', {
        manifest,
        updatedAt: this.globalData.manifestUpdatedAt
      })
    } catch (err) {
      console.error('保存 manifest 失败:', err)
      throw err
    }
  }
})
