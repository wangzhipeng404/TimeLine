// pages/camera/camera.js
const app = getApp()

Page({
  data: {
    mode: 'normal', // normal | align
    collectionId: '',
    referenceId: '',
    referenceUrl: '',
    alignGroupId: '',
    referenceOpacity: 0.4,
    referenceOpacityPercent: 40
  },

  onLoad(options) {
    this.setData({
      mode: options.mode || 'normal',
      collectionId: options.collectionId,
      referenceId: options.referenceId || '',
      referenceUrl: decodeURIComponent(options.referenceUrl || ''),
      alignGroupId: options.alignGroupId || ''
    })

    // 检查相机权限
    this.checkCameraPermission()
  },

  onReady() {
    this.cameraContext = wx.createCameraContext()
  },

  checkCameraPermission() {
    wx.getSetting({
      success: (res) => {
        if (!res.authSetting['scope.camera']) {
          wx.showModal({
            title: '需要相机权限',
            content: '请使用相机拍摄照片，需要开启相机权限',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.openSetting({
                  withSubscriptions: true
                })
              }
            }
          })
        }
      }
    })
  },

  onCameraStop() {
    // 相机停止回调
  },

  goBack() {
    wx.navigateBack()
  },

  switchCamera() {
    if (this.cameraContext) {
      this.cameraContext.switchCamera()
    }
  },

  onOpacityChange(e) {
    const percent = e.detail.value
    this.setData({
      referenceOpacityPercent: percent,
      referenceOpacity: percent / 100
    })
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      sourceType: ['album'],
      success: (res) => {
        const tempFilePath = res.tempFiles[0].tempFilePath

        // 跳转到确认页（使用 redirectTo 替换相机页，避免保存后返回时停留在相机页）
        const url = `/pages/record/record?collectionId=${this.data.collectionId}&tempPath=${encodeURIComponent(tempFilePath)}&mode=${this.data.mode}&referenceId=${this.data.referenceId}&alignGroupId=${this.data.alignGroupId}`
        wx.redirectTo({ url })
      },
      fail: (err) => {
        console.error('从相册选择图片失败:', err)
        wx.showToast({
          title: '选择失败',
          icon: 'none'
        })
      }
    })
  },

  takePhoto() {
    const cameraContext = wx.createCameraContext()

    cameraContext.takePhoto({
      quality: 'high',
      success: (res) => {
        // 不同小程序版本返回字段不同：tempImagePath 或 tempFilePath
        const tempFilePath = res.tempImagePath || res.tempFilePath || res.filePath

        if (!tempFilePath) {
          wx.showToast({
            title: '拍照失败',
            icon: 'none'
          })
          return
        }

        // 跳转到确认页（使用 redirectTo 替换相机页，避免保存后返回时停留在相机页）
        const url = `/pages/record/record?collectionId=${this.data.collectionId}&tempPath=${encodeURIComponent(tempFilePath)}&mode=${this.data.mode}&referenceId=${this.data.referenceId}&alignGroupId=${this.data.alignGroupId}`
        wx.redirectTo({ url })
      },
      fail: (err) => {
        console.error('拍照失败:', err)
        wx.showToast({
          title: '拍照失败',
          icon: 'none'
        })
      }
    })
  },

  onUnload() {
    // 清理相机（不需要手动 stop，页面卸载会自动清理）
  }
})
