// pages/collection/collection.js
const app = getApp()
const s3 = require('../../utils/s3')
const { loadImage } = s3
const { loadTimeline, saveTimeline, generateRecordId, generateAlignGroupId } = require('../../utils/collection')
const { compressImage, generateThumb, addWatermark, getImageInfo } = require('../../utils/image')

Page({
  data: {
    collectionId: '',
    collectionName: '',
    records: [],
    loading: true,
    showAddMenu: false,
    deleteIndex: -1,
    currentSlide: 0,
    hasAlignGroups: false,
    isOwner: true // 是否为合集所有者（从分享进入则为查看者）
  },

  onLoad(options) {
    this.setData({ collectionId: options.id })
    // 检查是否从分享进入（分享链接可能带有 fromShare 参数）
    if (options.fromShare === '1') {
      this.setData({ isOwner: false })
    }
    this.loadData()
  },

  onShow() {
    // 从记录页返回时刷新数据
    this.loadData()

    // 如果有未保存的记录，提示用户
    const pending = wx.getStorageSync('pending_record')
    if (pending) {
      wx.showModal({
        title: '未保存的记录',
        content: '有一条记录未保存，是否继续？',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: `/pages/record/record?collectionId=${this.data.collectionId}&pending=true`
            })
          }
          wx.removeStorageSync('pending_record')
        }
      })
    }
  },

  async loadData() {
    this.setData({ loading: true })

    try {
      const timeline = await loadTimeline(this.data.collectionId)
      if (timeline && timeline.records) {
        // 加载缩略图，并兼容旧数据字段名
        for (let i = 0; i < timeline.records.length; i++) {
          const record = timeline.records[i]
          // 兼容旧数据：capturedAt -> createdAt
          if (!record.capturedAt && record.createdAt) {
            record.capturedAt = record.createdAt
          }
          // 格式化日期和时间
          if (record.capturedAt) {
            const date = new Date(record.capturedAt)
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            const hour = String(date.getHours()).padStart(2, '0')
            const minute = String(date.getMinutes()).padStart(2, '0')
            record.dateStr = `${year}-${month}-${day} ${hour}:${minute}`
          }
          if (record.thumbKey) {
            try {
              const res = await loadImage(record.thumbKey)
              record.thumbUrl = res.filePath
            } catch (err) {
              console.error('加载缩略图失败:', err)
              record.thumbUrl = ''
            }
          }
        }

        // 检查是否有对位组
        const alignGroups = new Set()
        timeline.records.forEach(r => {
          if (r.alignGroupId) alignGroups.add(r.alignGroupId)
        })

        this.setData({
          collectionName: timeline.name || this.data.collectionName,
          records: timeline.records,
          hasAlignGroups: alignGroups.size > 0
        })

        console.log('加载的记录数据:', timeline.records)
      } else {
        this.setData({
          records: [],
          hasAlignGroups: false
        })
      }
    } catch (err) {
      console.error('加载时间线失败:', err)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }

    this.setData({ loading: false })
  },

  formatDate(dateStr) {
    if (!dateStr) return '无日期'
    const date = new Date(dateStr)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  },

  getDate(dateStr) {
    return this.formatDate(dateStr)
  },

  formatDateTime(dateStr) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  },

  onImageLoad(e) {
    // 图片加载完成
  },

  previewImage(e) {
    const index = e.currentTarget.dataset.index
    const urls = this.data.records.map(r => r.thumbUrl || r.mediaUrl)
    wx.previewImage({
      current: urls[index],
      urls: urls.filter(u => u)
    })
  },

  showNote(e) {
    const note = e.currentTarget.dataset.note
    wx.showModal({
      title: '备注',
      content: note,
      showCancel: false
    })
  },

  showAddMenu() {
    this.setData({ showAddMenu: true })
  },

  hideAddMenu() {
    this.setData({ showAddMenu: false })
  },

  takePhoto() {
    this.hideAddMenu()
    console.log('跳转相机，collectionId:', this.data.collectionId)
    if (!this.data.collectionId) {
      wx.showToast({
        title: '请先选择合集',
        icon: 'none'
      })
      return
    }
    // 默认与最后一条记录对位
    const lastRecord = this.data.records[this.data.records.length - 1]
    if (lastRecord && lastRecord.thumbKey) {
      // 有最后记录，进入对位模式
      loadImage(lastRecord.thumbKey).then(res => {
        const referenceUrl = res.filePath
        wx.navigateTo({
          url: `/pages/camera/camera?collectionId=${this.data.collectionId}&mode=align&referenceId=${lastRecord.id}&referenceUrl=${encodeURIComponent(referenceUrl)}&alignGroupId=${lastRecord.alignGroupId || ''}`
        })
      }).catch(err => {
        console.error('加载参考图失败:', err)
        // 加载失败则普通拍摄
        wx.navigateTo({
          url: `/pages/camera/camera?collectionId=${this.data.collectionId}&mode=normal`
        })
      })
    } else {
      // 没有记录，普通拍摄
      wx.navigateTo({
        url: `/pages/camera/camera?collectionId=${this.data.collectionId}&mode=normal`
      })
    }
  },

  chooseImage() {
    this.hideAddMenu()
    console.log('选择图片，collectionId:', this.data.collectionId)
    if (!this.data.collectionId) {
      wx.showToast({
        title: '请先选择合集',
        icon: 'none'
      })
      return
    }
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0]
        console.log('选择图片成功，路径:', tempFilePath)
        wx.navigateTo({
          url: `/pages/record/record?collectionId=${this.data.collectionId}&tempPath=${encodeURIComponent(tempFilePath)}`
        })
      }
    })
  },

  async alignShoot(e) {
    const index = e.currentTarget.dataset.index
    const record = this.data.records[index]

    this.hideAddMenu()

    // 加载参考图
    let referenceUrl = ''
    if (record.thumbKey) {
      try {
        const res = await loadImage(record.thumbKey)
        referenceUrl = res.filePath
      } catch (err) {
        wx.showToast({
          title: '参考图加载失败，将普通拍摄',
          icon: 'none'
        })
      }
    }

    wx.navigateTo({
      url: `/pages/camera/camera?collectionId=${this.data.collectionId}&mode=align&referenceId=${record.id}&referenceUrl=${encodeURIComponent(referenceUrl)}&alignGroupId=${record.alignGroupId || ''}`
    })
  },

  onSlideTap(e) {
    // 切换幻灯片
    const index = e.currentTarget.dataset.index
    this.setData({ currentSlide: index })
  },

  showActionMenu(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ deleteIndex: index })

    wx.showActionSheet({
      itemList: ['删除'],
      success: (res) => {
        if (res.tapIndex === 0) {
          this.showDeleteConfirm()
        }
      }
    })
  },

  showDeleteConfirm() {
    const index = this.data.deleteIndex
    if (index < 0 || index >= this.data.records.length) {
      return
    }

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？此操作不可恢复。',
      confirmColor: '#f44336',
      success: (res) => {
        if (res.confirm) {
          this.deleteRecord(index)
        }
      }
    })
  },

  async deleteRecord(index) {
    try {
      const { loadTimeline, saveTimeline } = require('../../utils/collection')
      const timeline = await loadTimeline(this.data.collectionId)

      if (timeline && timeline.records) {
        // 删除记录
        timeline.records.splice(index, 1)
        await saveTimeline(this.data.collectionId, timeline)

        // 刷新数据
        await this.loadData()

        wx.showToast({
          title: '已删除',
          icon: 'success'
        })
      }
    } catch (err) {
      console.error('删除失败:', err)
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      })
    }
  },

  // 转发给好友
  onShareAppMessage() {
    const { collectionName, records } = this.data
    const count = records.length

    return {
      title: `${collectionName} · ${count}次记录`,
      path: `/pages/collection/collection?id=${this.data.collectionId}&fromShare=1`,
      imageUrl: records.length > 0 ? records[0].thumbUrl : undefined
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    const { collectionName, records } = this.data
    const count = records.length
    const date = new Date()
    const month = date.getMonth() + 1
    const day = date.getDate()

    // 根据时间段生成不同的文案
    const hour = date.getHours()
    let timeGreeting = ''
    if (hour < 6) {
      timeGreeting = '深夜记录'
    } else if (hour < 12) {
      timeGreeting = '早安'
    } else if (hour < 18) {
      timeGreeting = '下午好'
    } else {
      timeGreeting = '晚上好'
    }

    return {
      title: `${timeGreeting}，${collectionName} · ${count}次记录`,
      query: `id=${this.data.collectionId}&fromShare=1`,
      imageUrl: records.length > 0 ? records[0].thumbUrl : undefined
    }
  }
})
