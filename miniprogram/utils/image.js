/**
 * 图片处理工具
 * 压缩、缩略图、水印合成
 */

/**
 * 压缩图片
 * @param {string} tempPath - 临时文件路径
 * @param {number} maxWidth - 最大宽度
 * @param {number} quality - 压缩质量 (0-100)
 */
function compressImage(tempPath, maxWidth = 1080, quality = 75) {
  return new Promise((resolve, reject) => {
    // 先获取图片信息
    wx.getImageInfo({
      src: tempPath,
      success: (infoRes) => {
        const { width, height } = infoRes
        const scale = Math.min(1, maxWidth / width)
        const newWidth = Math.round(width * scale)
        const newHeight = Math.round(height * scale)

        wx.compressImage({
          src: tempPath,
          destWidth: newWidth,
          destHeight: newHeight,
          quality,
          success: (compressRes) => {
            resolve(compressRes.tempFilePath)
          },
          fail: (err) => {
            // 压缩失败则直接返回原图
            resolve(tempPath)
          }
        })
      },
      fail: (err) => {
        reject(err)
      }
    })
  })
}

/**
 * 生成缩略图
 * @param {string} tempPath - 临时文件路径
 * @param {number} width - 缩略图宽度
 */
function generateThumb(tempPath, width = 300) {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src: tempPath,
      success: (infoRes) => {
        const { width: origWidth, height: origHeight } = infoRes
        const scale = width / origWidth
        const newHeight = Math.round(origHeight * scale)

        // 使用 canvas 生成缩略图
        const canvas = wx.createCanvasContext('thumbCanvas')
        canvas.drawImage(tempPath, 0, 0, width, newHeight)
        canvas.draw(false)

        setTimeout(() => {
          wx.canvasToTempFilePath({
            canvasId: 'thumbCanvas',
            destWidth: width,
            destHeight: newHeight,
            success: (res) => {
              resolve(res.tempFilePath)
            },
            fail: (err) => {
              // 降级：直接用压缩
              compressImage(tempPath, width, 60)
                .then(resolve)
                .catch(reject)
            }
          }, this)
        }, 100)
      },
      fail: (err) => {
        // 降级：直接用压缩
        compressImage(tempPath, width, 60)
          .then(resolve)
          .catch(reject)
      }
    })
  })
}

/**
 * 添加水印
 * @param {string} imagePath - 图片路径
 * @param {object} watermark - 水印信息 {dateText, collectionName, seq, enabled}
 * @param {number} imageWidth - 原图宽度
 * @param {number} imageHeight - 原图高度
 */
function addWatermark(imagePath, watermark, imageWidth, imageHeight) {
  return new Promise((resolve, reject) => {
    if (!watermark || !watermark.enabled) {
      resolve(imagePath)
      return
    }

    const canvas = wx.createCanvasContext('watermarkCanvas')
    const padding = imageWidth * 0.03 // 3% 边距
    const fontSize = Math.max(24, imageWidth * 0.04) // 4% 字号
    const lineHeight = fontSize * 1.4
    const textPadding = 10

    // 计算文本宽度
    const text1 = `${watermark.dateText}  ${watermark.collectionName}`
    const text2 = `第 ${watermark.seq} 次记录`

    // 背景条高度
    const bgHeight = lineHeight * 2 + textPadding * 2
    const bgWidth = Math.max(imageWidth * 0.4, 300) // 最小宽度

    // 绘制背景
    canvas.setFillStyle('rgba(0, 0, 0, 0.6)')
    canvas.fillRect(
      imageWidth - bgWidth - padding,
      imageHeight - bgHeight - padding,
      bgWidth,
      bgHeight
    )

    // 绘制文字
    canvas.setTextAlign('left')
    canvas.setTextBaseline('top')
    canvas.setFontSize(fontSize)
    canvas.setFillStyle('#ffffff')

    canvas.fillText(
      text1,
      imageWidth - bgWidth - padding + textPadding,
      imageHeight - bgHeight - padding + textPadding
    )
    canvas.fillText(
      text2,
      imageWidth - bgWidth - padding + textPadding,
      imageHeight - bgHeight - padding + textPadding + lineHeight
    )

    canvas.draw(false)

    setTimeout(() => {
      wx.canvasToTempFilePath({
        canvasId: 'watermarkCanvas',
        x: 0,
        y: 0,
        width: imageWidth,
        height: imageHeight,
        destWidth: imageWidth,
        destHeight: imageHeight,
        success: (res) => {
          resolve(res.tempFilePath)
        },
        fail: (err) => {
          // 水印失败返回原图
          resolve(imagePath)
        }
      }, this)
    }, 200)
  })
}

/**
 * 获取图片信息
 */
function getImageInfo(path) {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src: path,
      success: resolve,
      fail: reject
    })
  })
}

module.exports = {
  compressImage,
  generateThumb,
  addWatermark,
  getImageInfo
}
