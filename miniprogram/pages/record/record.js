// pages/record/record.js
const app = getApp()
const s3 = require('../../utils/s3')
const { uploadFile, loadImage } = s3
const { loadTimeline, saveTimeline, generateRecordId, generateAlignGroupId } = require('../../utils/collection')
const { compressImage, generateThumb, addWatermark, getImageInfo } = require('../../utils/image')

Page({
  data: {
    collectionId: '',
    tempPath: '',
    mode: 'normal', // normal | align
    referenceId: '',
    alignGroupId: '',
    previewImage: '',
    imageWidth: 0,
    imageHeight: 0,
    note: '',
    watermarkEnabled: true,
    watermarkText1: '',
    watermarkText2: '',
    capturedAt: '',
    isAlignMode: false,
    referenceDate: '',
    saving: false,
    showDatePicker: false,
    datePickerValue: '',
    timePickerValue: '',
    today: '',
    imageError: false
  },

  onLoad(options) {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const dateStr = now.toISOString().slice(0, 10)
    const timeStr = now.toTimeString().slice(0, 5)

    const tempPath = decodeURIComponent(options.tempPath || '')
    console.log('接收到的临时文件路径:', tempPath)

    this.setData({
      collectionId: options.collectionId,
      tempPath: tempPath,
      mode: options.mode || 'normal',
      referenceId: options.referenceId || '',
      alignGroupId: options.alignGroupId || '',
      capturedAt: now.toISOString(),
      datePickerValue: dateStr,
      timePickerValue: timeStr,
      today,
      isAlignMode: options.mode === 'align',
      previewImage: tempPath,
      imageError: false
    })

    // 如果是 pending 模式，加载暂存数据
    if (options.pending === 'true') {
      const pending = wx.getStorageSync('pending_record')
      if (pending) {
        this.setData({
          tempPath: pending.tempPath,
          note: pending.note || '',
          capturedAt: pending.capturedAt || now.toISOString(),
          datePickerValue: pending.capturedAt ? pending.capturedAt.slice(0, 10) : dateStr,
          timePickerValue: pending.capturedAt ? pending.capturedAt.slice(11, 16) : timeStr
        })
      }
    }

    // 加载参考日期
    if (this.data.isAlignMode && this.data.referenceId) {
      this.loadReferenceDate()
    }

    // 加载图片
    if (this.data.tempPath) {
      this.updateWatermark()
    }
  },

  async loadReferenceDate() {
    try {
      const timeline = await loadTimeline(this.data.collectionId)
      const record = timeline.records.find(r => r.id === this.data.referenceId)
      if (record) {
        this.setData({
          referenceDate: record.capturedAt
        })
      }
    } catch (err) {
      console.error('加载参考记录失败:', err)
    }
  },

  onImageLoad(e) {
    const { width, height } = e.detail
    this.setData({
      imageWidth: width,
      imageHeight: height,
      imageError: false
    })
    this.updateWatermark()
  },

  onImageError(e) {
    console.error('图片加载失败:', e)
    this.setData({ imageError: true })
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value })
  },

  onWatermarkToggle(e) {
    this.setData({
      watermarkEnabled: !this.data.watermarkEnabled
    })
    this.updateWatermark()
  },

  updateWatermark() {
    if (!this.data.watermarkEnabled || !this.data.imageWidth) return

    const now = new Date(this.data.capturedAt)
    const dateText = now.toISOString().split('T')[0]

    // 获取记录序号
    let seq = 1
    try {
      const timeline = wx.getStorageSync(`timeline_${this.data.collectionId}`)
      if (timeline && timeline.records) {
        seq = timeline.records.length + 1
      }
    } catch (err) {
      // 忽略
    }

    const collectionName = app.getManifest().collections.find(c => c.id === this.data.collectionId)?.name || '合集'

    this.setData({
      watermarkText1: `${dateText}  ${collectionName}`,
      watermarkText2: `第 ${seq} 次记录`
    })
  },

  showDatePicker() {
    this.setData({ showDatePicker: true })
  },

  hideDatePicker() {
    this.setData({ showDatePicker: false })
  },

  onDateChange(e) {
    this.setData({ datePickerValue: e.detail.value })
  },

  onTimeChange(e) {
    this.setData({ timePickerValue: e.detail.value })
  },

  confirmDate() {
    const dateStr = this.data.datePickerValue
    const timeStr = this.data.timePickerValue
    const capturedAt = `${dateStr}T${timeStr}:00`

    this.setData({
      capturedAt,
      showDatePicker: false
    })
    this.updateWatermark()
  },

  retake() {
    wx.navigateBack()
  },

  async save() {
    if (!this.data.tempPath) {
      wx.showToast({
        title: '图片不存在',
        icon: 'none'
      })
      return
    }

    this.setData({ saving: true })

    try {
      const { compressImage, generateThumb, addWatermark, getImageInfo } = require('../../utils/image')
      const { generateRecordId } = require('../../utils/collection')

      // 1. 压缩图片
      const compressedPath = await compressImage(this.data.tempPath, 1080, 75)

      // 2. 获取图片信息
      const imgInfo = await getImageInfo(compressedPath)

      // 3. 添加水印
      const now = new Date(this.data.capturedAt)
      const dateText = now.toISOString().split('T')[0]
      const collectionName = app.getManifest().collections.find(c => c.id === this.data.collectionId)?.name || '合集'

      // 获取记录序号
      let seq = 1
      try {
        const timeline = wx.getStorageSync(`timeline_${this.data.collectionId}`)
        if (timeline && timeline.records) {
          seq = timeline.records.length + 1
        }
      } catch (err) {
        // 忽略
      }

      const watermark = {
        enabled: this.data.watermarkEnabled,
        dateText,
        collectionName,
        seq
      }

      const watermarkedPath = await addWatermark(
        compressedPath,
        watermark,
        imgInfo.width,
        imgInfo.height
      )

      // 4. 生成缩略图
      const thumbPath = await generateThumb(watermarkedPath, 300)

      // 5. 生成记录 ID
      const recordId = generateRecordId()

      // 6. 上传文件
      const mediaKey = `collections/${this.data.collectionId}/media/${recordId}.jpg`
      const thumbKey = `collections/${this.data.collectionId}/thumbs/${recordId}.jpg`

      await uploadFile(watermarkedPath, mediaKey, 'image/jpeg')
      await uploadFile(thumbPath, thumbKey, 'image/jpeg')

      // 7. 更新 timeline.json
      const timeline = await loadTimeline(this.data.collectionId) || {
        collectionId: this.data.collectionId,
        name: collectionName,
        records: []
      }

      const newRecord = {
        id: recordId,
        capturedAt: this.data.capturedAt,
        mediaKey,
        thumbKey,
        note: this.data.note,
        alignGroupId: this.data.isAlignMode ? (this.data.alignGroupId || `ag_${collectionName.slice(0, 3)}_${Date.now().toString(36)}`) : null,
        referenceRecordId: this.data.isAlignMode ? this.data.referenceId : null,
        watermark: {
          ...watermark,
          seq: timeline.records.length + 1
        }
      }

      timeline.records.unshift(newRecord)
      timeline.updatedAt = new Date().toISOString()

      await saveTimeline(this.data.collectionId, timeline)

      // 8. 更新 manifest
      const manifest = app.getManifest()
      const collection = manifest.collections.find(c => c.id === this.data.collectionId)
      if (collection) {
        collection.coverKey = thumbKey
        collection.recordCount = (collection.recordCount || 0) + 1
        collection.lastRecordAt = new Date().toISOString()
      }
      try {
        await app.saveManifest(manifest)
      } catch (err) {
        console.error('保存 manifest 失败，但将继续返回:', err)
      }

      // 9. 返回合集页
      wx.navigateBack({
        delta: 1,
        fail: () => {
          // 如果返回失败，尝试更深层返回
          wx.navigateBack({ delta: 2 })
        }
      })

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })
    } catch (err) {
      console.error('保存失败:', err)
      wx.showToast({
        title: '保存失败，请重试',
        icon: 'none'
      })
    } finally {
      this.setData({ saving: false })
    }
  },

  formatDate(dateStr) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }
})
