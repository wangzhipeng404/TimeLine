// pages/settings/settings.js
const app = getApp()
const { loadJson, saveJson } = require('../../utils/s3')

Page({
  data: {
    cacheSize: '0 MB'
  },

  onLoad() {
    this.calculateCacheSize()
  },

  async calculateCacheSize() {
    try {
      const fs = wx.getFileSystemManager()
      const fileInfo = fs.getFileInfo({
        filePath: wx.env.USER_DATA_PATH
      })
      if (fileInfo && fileInfo.size) {
        const sizeMB = (fileInfo.size / (1024 * 1024)).toFixed(2)
        this.setData({ cacheSize: `${sizeMB} MB` })
      } else {
        // 尝试获取存储大小
        const storageInfo = wx.getStorageInfoSync()
        const sizeKB = storageInfo.currentSize || 0
        const sizeMB = (sizeKB / 1024).toFixed(2)
        this.setData({ cacheSize: `${sizeMB} MB` })
      }
    } catch (err) {
      console.error('获取缓存大小失败:', err)
      this.setData({ cacheSize: '未知' })
    }
  },

  async exportBackup() {
    wx.showLoading({ title: '正在导出...' })

    try {
      const manifest = app.getManifest()
      const backup = {
        version: '1.0',
        exportTime: new Date().toISOString(),
        manifest,
        collections: []
      }

      // 加载每个合集的时间线
      for (const collection of manifest.collections) {
        const timeline = await loadJson(`collections/${collection.id}/timeline.json`)
        backup.collections.push({
          id: collection.id,
          name: collection.name,
          timeline
        })
      }

      // 生成 JSON 文件
      const jsonStr = JSON.stringify(backup, null, 2)
      const fileName = `timeline_backup_${new Date().toISOString().slice(0, 10)}.json`
      const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`

      const fs = wx.getFileSystemManager()
      fs.writeFileSync(filePath, jsonStr, 'utf8')

      wx.hideLoading()

      // 提供保存选项
      wx.showModal({
        title: '导出完成',
        content: `备份文件已保存为：${fileName}\n\n是否发送到文件传输助手？`,
        confirmText: '发送',
        cancelText: '仅保存',
        success: (res) => {
          if (res.confirm) {
            // 发送到文件传输助手
            wx.shareFileMessage({
              filePath,
              fileName,
              fail: (err) => {
                console.error('发送失败:', err)
                wx.showToast({
                  title: '发送失败，文件已保存',
                  icon: 'none'
                })
              }
            })
          }
          // 保存到本地
          wx.saveFile({
            tempFilePath: filePath,
            success: (res) => {
              console.log('已保存到:', res.savedFilePath)
            }
          })
        }
      })
    } catch (err) {
      wx.hideLoading()
      console.error('导出失败:', err)
      wx.showToast({
        title: '导出失败',
        icon: 'none'
      })
    }
  },

  clearCache() {
    wx.showModal({
      title: '清空缓存',
      content: '将清除所有本地缓存数据和图片，云端数据不受影响。确定继续？',
      confirmColor: '#f44336',
      success: (res) => {
        if (res.confirm) {
          try {
            const fs = wx.getFileSystemManager()
            const cacheKeys = ['manifest', 'img_']

            // 清除缓存
            for (const key of cacheKeys) {
              const keys = Object.keys(wx.getStorageInfoSync().keys)
              keys.forEach(k => {
                if (k.startsWith(key)) {
                  wx.removeStorageSync(k)
                }
              })
            }

            // 清除本地图片缓存
            fs.readdirSync(wx.env.USER_DATA_PATH).forEach(file => {
              if (file.endsWith('.jpg') || file.endsWith('.png')) {
                fs.unlinkSync(`${wx.env.USER_DATA_PATH}/${file}`)
              }
            })

            this.setData({ cacheSize: '0 MB' })
            wx.showToast({
              title: '已清空缓存',
              icon: 'success'
            })

            // 刷新页面
            setTimeout(() => {
              wx.navigateBack()
            }, 1500)
          } catch (err) {
            console.error('清空缓存失败:', err)
            wx.showToast({
              title: '清空失败',
              icon: 'none'
            })
          }
        }
      }
    })
  }
})
