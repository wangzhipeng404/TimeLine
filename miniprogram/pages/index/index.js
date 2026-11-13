// pages/index/index.js
const app = getApp()
const s3 = require('../../utils/s3')
const { loadImage } = s3
const { createCollection, deleteCollection } = require('../../utils/collection')

Page({
  data: {
    collections: [],
    loading: true,
    isOnline: true,
    showNewDialog: false,
    newCollectionName: '',
    selectedCollection: null
  },

  onLoad() {
    this.loadData()
  },

  onShow() {
    // 每次显示时刷新数据
    this.refreshData()
  },

  async loadData() {
    this.setData({ loading: true })

    const manifest = app.getManifest()
    if (manifest && manifest.collections) {
      await this.loadCollectionImages(manifest.collections)
      this.setData({
        collections: manifest.collections,
        loading: false
      })
    } else {
      this.setData({ collections: [], loading: false })
    }

    this.setData({
      isOnline: app.globalData.isOnline
    })
  },

  async refreshData() {
    try {
      await app.refreshManifest()
      await this.loadData()
    } catch (err) {
      console.error('刷新数据失败:', err)
      this.setData({ isOnline: false })
    }
  },

  async loadCollectionImages(collections) {
    // 加载每个合集的封面图
    for (let i = 0; i < collections.length; i++) {
      const collection = collections[i]
      if (collection.coverKey) {
        try {
          const res = await loadImage(collection.coverKey)
          collection.coverUrl = res.filePath
        } catch (err) {
          collection.coverUrl = null
        }
      }
    }
  },

  formatDate(dateStr) {
    if (!dateStr) return '暂无记录'
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now - date

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    if (days === 0) return '今天'
    if (days === 1) return '昨天'
    if (days < 7) return `${days}天前`

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  },

  goToCollection(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/collection/collection?id=${id}`
    })
  },

  goToSettings() {
    wx.navigateTo({
      url: '/pages/settings/settings'
    })
  },

  showNewCollectionDialog() {
    this.setData({
      showNewDialog: true,
      newCollectionName: ''
    })
  },

  hideNewCollectionDialog() {
    this.setData({
      showNewDialog: false,
      newCollectionName: ''
    })
  },

  onNameInput(e) {
    this.setData({
      newCollectionName: e.detail.value
    })
  },

  async createCollection() {
    const name = this.data.newCollectionName.trim()
    if (!name) {
      wx.showToast({
        title: '请输入合集名称',
        icon: 'none'
      })
      return
    }

    try {
      const manifest = app.getManifest()
      if (!manifest.collections) {
        manifest.collections = []
      }

      const collection = createCollection(name)
      manifest.collections.push(collection)

      // 初始化时间线
      const { saveTimeline } = require('../../utils/collection')
      await saveTimeline(collection.id, {
        collectionId: collection.id,
        name: collection.name,
        updatedAt: new Date().toISOString(),
        records: []
      })

      // 保存 manifest
      await app.saveManifest(manifest)

      this.hideNewCollectionDialog()
      await this.loadData()

      // 进入该合集
      wx.navigateTo({
        url: `/pages/collection/collection?id=${collection.id}`
      })
    } catch (err) {
      console.error('创建合集失败:', err)
      wx.showToast({
        title: '创建失败，请重试',
        icon: 'none'
      })
    }
  },

  showCollectionMenu(e) {
    const index = e.currentTarget.dataset.index
    const collection = this.data.collections[index]

    this.setData({ selectedCollection: collection })

    wx.showActionSheet({
      itemList: ['重命名', '下载合集', '删除合集'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.renameCollection()
        } else if (res.tapIndex === 1) {
          this.downloadCollection()
        } else if (res.tapIndex === 2) {
          this.deleteCollection()
        }
      }
    })
  },

  async renameCollection() {
    const newName = await new Promise((resolve) => {
      const value = this.data.selectedCollection?.name || ''
      wx.showModal({
        title: '重命名合集',
        editable: true,
        placeholderText: '请输入新名称',
        content: value,
        success: (res) => {
          if (res.confirm && res.content.trim()) {
            resolve(res.content.trim())
          } else {
            resolve(null)
          }
        }
      })
    })

    if (newName) {
      try {
        const manifest = app.getManifest()
        const collection = manifest.collections.find(c => c.id === this.data.selectedCollection?.id)
        if (collection) {
          collection.name = newName

          // 更新 meta.json
          const { loadMeta, saveMeta } = require('../../utils/collection')
          const meta = await loadMeta(collection.id)
          if (meta) {
            meta.name = newName
            await saveMeta(collection.id, meta)
          }

          await app.saveManifest(manifest)
          await this.loadData()
        }
      } catch (err) {
        console.error('重命名失败:', err)
        wx.showToast({
          title: '重命名失败',
          icon: 'none'
        })
      }
    }
  },

  async deleteCollection() {
    const collection = this.data.selectedCollection

    wx.showModal({
      title: '删除合集',
      content: '确定要删除这个合集吗？此操作不可恢复。',
      confirmColor: '#f44336',
      success: async (res) => {
        if (res.confirm) {
          try {
            const manifest = app.getManifest()
            deleteCollection(manifest, collection.id)
            await app.saveManifest(manifest)

            await this.loadData()
            wx.showToast({
              title: '已删除',
              icon: 'success'
            })
          } catch (err) {
            console.error('删除失败:', err)
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  // 下载合集到本地相册
  async downloadCollection() {
    const collection = this.data.selectedCollection

    // 检查是否有记录
    if (!collection || collection.recordCount === 0) {
      wx.showToast({
        title: '该合集中没有可下载的图片',
        icon: 'none'
      })
      return
    }

    // 先检查权限
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.writePhotosAlbum'] === false) {
          wx.showModal({
            title: '需要权限',
            content: '需要访问相册权限才能保存图片，是否现在开启？',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.openSetting({
                  success: (settingRes) => {
                    if (settingRes.authSetting['scope.writePhotosAlbum']) {
                      this.downloadCollection()
                    }
                  }
                })
              }
            }
          })
          return
        }
        this.startDownload(collection)
      }
    })
  },

  async startDownload(collection) {
    wx.showLoading({
      title: '正在下载...',
      mask: true
    })

    try {
      // 加载时间线获取所有记录
      const { loadTimeline } = require('../../utils/collection')
      const timeline = await loadTimeline(collection.id)

      if (!timeline || !timeline.records || timeline.records.length === 0) {
        wx.hideLoading()
        wx.showToast({
          title: '该合集中没有可下载的图片',
          icon: 'none'
        })
        return
      }

      const records = timeline.records
      const total = records.length
      let downloaded = 0
      let failed = 0

      // 下载所有图片
      for (let i = 0; i < total; i++) {
        const record = records[i]
        try {
          // 优先使用原图，如果没有则使用缩略图
          const imageKey = record.mediaKey || record.thumbKey
          if (!imageKey) continue

          const { loadImage } = require('../../utils/s3')
          const res = await loadImage(imageKey)
          const filePath = res.filePath

          // 保存到相册
          await new Promise((resolve, reject) => {
            wx.saveImageToPhotosAlbum({
              filePath,
              success: () => {
                downloaded++
                resolve()
              },
              fail: (err) => {
                failed++
                console.error('保存图片失败:', err)
                reject(err)
              }
            })
          })

          // 更新进度
          wx.showLoading({
            title: `正在下载 ${downloaded}/${total}...`,
            mask: true
          })
        } catch (err) {
          console.error(`下载失败: ${record.id}`, err)
          failed++
        }
      }

      wx.hideLoading()

      // 显示下载结果
      let message = `已保存 ${downloaded} 张图片到相册`
      if (failed > 0) {
        message += `\n${failed} 张保存失败`
      }

      wx.showModal({
        title: '下载完成',
        content: message,
        showCancel: false,
        confirmText: '知道了'
      })
    } catch (err) {
      wx.hideLoading()
      console.error('下载合集失败:', err)
      wx.showToast({
        title: '下载失败',
        icon: 'none'
      })
    }
  }
})
