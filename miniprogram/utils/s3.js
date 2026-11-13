/**
 * 存储工具类
 * 支持 S3 云存储和本地临时存储两种模式
 * 当 S3 未配置时，自动降级到本地临时存储
 *
 * 用户隔离：所有 S3 存储的文件都基于用户 ID 进行目录隔离
 * 存储结构：{userId}/{originalKey}
 */

// S3 配置（未配置时使用本地存储）
const S3_CONFIG = {
  endpoint: 'https://s3.cstcloud.cn',
  bucket: 'timeline',
  region: 'us-east-1',
  customUserAgent: 'rclone/v1.68.0',
  // 是否启用 S3（当云函数不可用时自动降级）
  enabled: true
}

// 本地存储路径
const LOCAL_STORAGE_KEY = 'timeline_local_data'

/**
 * 获取当前用户 ID（使用云开发 OpenID）
 */
function getUserId() {
  try {
    return wx.cloud.getOpenId()
  } catch (err) {
    console.error('获取用户 ID 失败:', err)
    return 'unknown_user'
  }
}

/**
 * 生成用户隔离的 S3 key
 * @param {string} key - 原始 key
 * @returns {string} - 带用户前缀的 key，格式：{userId}/{originalKey}
 */
function getUserKey(key) {
  const userId = getUserId()
  // 移除原始 key 可能已有的前缀，避免重复
  const cleanKey = key.replace(/^([^\/]+)\//, '')
  return `${userId}/${cleanKey}`
}

/**
 * 从用户隔离的 key 中提取原始 key
 * @param {string} userKey - 带用户前缀的 key
 * @returns {string} - 原始 key
 */
function getOriginalKey(userKey) {
  const parts = userKey.split('/')
  if (parts.length > 1) {
    return parts.slice(1).join('/')
  }
  return userKey
}

/**
 * 检查 S3 是否可用
 */
function isS3Enabled() {
  return S3_CONFIG.enabled
}

/**
 * 获取本地存储数据
 */
function getLocalData() {
  try {
    const data = wx.getStorageSync(LOCAL_STORAGE_KEY)
    if (data) {
      return JSON.parse(data)
    }
  } catch (err) {
    console.error('读取本地数据失败:', err)
  }
  return { files: {} }
}

/**
 * 保存本地存储数据
 */
function saveLocalData(data) {
  try {
    wx.setStorageSync(LOCAL_STORAGE_KEY, JSON.stringify(data))
  } catch (err) {
    console.error('保存本地数据失败:', err)
  }
}

/**
 * 获取预签名 URL
 * 自动使用用户隔离的 key
 */
function getPresignedUrl(method, key, contentType = '', expiresIn = 900) {
  // 对用户隔离的 key 进行 S3 操作
  const userKey = getUserKey(key)
  return new Promise((resolve, reject) => {
    wx.cloud.callFunction({
      name: 'getPresignedUrl',
      data: {
        method,
        key: userKey,
        contentType,
        expiresIn
      },
      success: (res) => {
        if (res.result && res.result.url) {
          resolve(res.result)
        } else {
          // 云函数调用失败，标记 S3 不可用
          S3_CONFIG.enabled = false
          reject(new Error('云函数不可用，切换到本地存储模式'))
        }
      },
      fail: (err) => {
        // 云函数不可用，标记 S3 不可用
        S3_CONFIG.enabled = false
        reject(new Error('云函数不可用，切换到本地存储模式'))
      }
    })
  })
}

/**
 * 上传文件
 * 自动使用用户隔离的 key
 */
function uploadFile(localPath, key, contentType = 'image/jpeg') {
  const userKey = getUserKey(key)
  return new Promise((resolve, reject) => {
    // 尝试使用本地存储
    if (!isS3Enabled()) {
      // 读取文件内容并保存到本地存储（本地存储不使用隔离）
      const fs = wx.getFileSystemManager()
      fs.readFile({
        filePath: localPath,
        encoding: 'base64',
        success: (fileRes) => {
          const data = getLocalData()
          data.files[key] = {
            content: fileRes.data,
            contentType: contentType,
            uploadedAt: new Date().toISOString()
          }
          saveLocalData(data)
          resolve({ key })
        },
        fail: (err) => {
          reject(new Error(`读取文件失败：${err.errMsg}`))
        }
      })
      return
    }

    // 使用 S3 上传
    getPresignedUrl('PUT', key, contentType, 900)
      .then(res => {
        const url = res.url
        if (!url) {
          throw new Error('获取预签名 URL 失败')
        }

        const fs = wx.getFileSystemManager()
        fs.readFile({
          filePath: localPath,
          encoding: 'binary',
          success: (fileRes) => {
            wx.request({
              url,
              method: 'PUT',
              data: fileRes.data,
              header: {
                'Content-Type': contentType
              },
              responseType: 'text',
              success: (uploadRes) => {
                if (uploadRes.statusCode >= 200 && uploadRes.statusCode < 300) {
                  resolve({ key })
                } else {
                  // S3 上传失败，降级到本地存储
                  console.warn('S3 上传失败，切换到本地存储')
                  S3_CONFIG.enabled = false
                  uploadFile(localPath, key, contentType).then(resolve).catch(reject)
                }
              },
              fail: (err) => {
                // S3 上传失败，降级到本地存储
                console.warn('S3 上传失败，切换到本地存储')
                S3_CONFIG.enabled = false
                uploadFile(localPath, key, contentType).then(resolve).catch(reject)
              }
            })
          },
          fail: (err) => {
            reject(new Error(`读取文件失败：${err.errMsg}`))
          }
        })
      })
      .catch(err => {
        // S3 不可用，降级到本地存储
        console.warn('S3 不可用，切换到本地存储:', err.message)
        S3_CONFIG.enabled = false
        uploadFile(localPath, key, contentType).then(resolve).catch(reject)
      })
  })
}

/**
 * 下载 JSON 文件
 * 自动使用用户隔离的 key
 */
function loadJson(key) {
  return new Promise((resolve, reject) => {
    // 尝试从本地存储加载（本地存储不使用隔离）
    if (!isS3Enabled()) {
      const data = getLocalData()
      if (data.files[key]) {
        try {
          const fileData = data.files[key]
          if (fileData.contentType === 'application/json') {
            resolve(JSON.parse(fileData.content))
          } else {
            resolve(fileData.content)
          }
        } catch (err) {
          resolve(null)
        }
      } else {
        resolve(null)
      }
      return
    }

    // 使用 S3 下载（使用用户隔离的 key）
    getPresignedUrl('GET', key, '', 3600)
      .then(res => {
        const url = res.url
        if (!url) {
          throw new Error('获取预签名 URL 失败')
        }

        wx.request({
          url,
          method: 'GET',
          responseType: 'text',
          success: (res) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const data = JSON.parse(res.data)
                resolve(data)
              } catch (err) {
                reject(new Error(`解析 JSON 失败：${err.message}`))
              }
            } else {
              if (res.statusCode === 404) {
                resolve(null)
              } else {
                // S3 下载失败，降级到本地存储
                console.warn('S3 下载失败，尝试本地存储')
                S3_CONFIG.enabled = false
                loadJson(key).then(resolve).catch(reject)
              }
            }
          },
          fail: (err) => {
            // S3 下载失败，降级到本地存储
            console.warn('S3 下载失败，尝试本地存储')
            S3_CONFIG.enabled = false
            loadJson(key).then(resolve).catch(reject)
          }
        })
      })
      .catch(err => {
        // S3 不可用，降级到本地存储
        console.warn('S3 不可用，尝试本地存储:', err.message)
        S3_CONFIG.enabled = false
        loadJson(key).then(resolve).catch(reject)
      })
  })
}

/**
 * 保存 JSON 文件
 * 自动使用用户隔离的 key
 */
function saveJson(key, data) {
  return new Promise((resolve, reject) => {
    // 尝试使用本地存储（本地存储不使用隔离）
    if (!isS3Enabled()) {
      const localData = getLocalData()
      localData.files[key] = {
        content: JSON.stringify(data, null, 2),
        contentType: 'application/json',
        uploadedAt: new Date().toISOString()
      }
      saveLocalData(localData)
      resolve()
      return
    }

    // 使用 S3 保存（使用用户隔离的 key）
    const userKey = getUserKey(key)
    const tempPath = wx.env.USER_DATA_PATH + '/temp_' + userKey.replace(/\//g, '_') + '.json'
    const fs = wx.getFileSystemManager()

    try {
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8')

      uploadFile(tempPath, key, 'application/json')
        .then(() => {
          fs.unlinkSync(tempPath)
          resolve()
        })
        .catch(err => {
          fs.unlinkSync(tempPath)
          reject(err)
        })
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * 下载图片
 * 自动使用用户隔离的 key
 */
function loadImage(key) {
  return new Promise((resolve, reject) => {
    // 检查本地缓存（本地缓存不使用隔离）
    const cacheKey = 'img_' + key
    const cached = wx.getStorageSync(cacheKey)
    if (cached) {
      resolve({ filePath: cached, fromCache: true })
      return
    }

    // 尝试从本地存储加载（本地存储不使用隔离）
    if (!isS3Enabled()) {
      const data = getLocalData()
      if (data.files[key] && data.files[key].content) {
        // 将 base64 内容保存为临时文件
        const tempPath = wx.env.USER_DATA_PATH + '/' + key.replace(/\//g, '_') + '.jpg'
        const fs = wx.getFileSystemManager()
        try {
          fs.writeFileSync(tempPath, data.files[key].content, 'base64')
          wx.setStorageSync(cacheKey, tempPath)
          resolve({ filePath: tempPath, fromCache: false })
        } catch (err) {
          console.error('保存本地图片失败:', err)
          // 尝试直接返回 base64
          const base64Url = 'data:image/jpeg;base64,' + data.files[key].content
          resolve({ filePath: base64Url, fromCache: false })
        }
      } else {
        reject(new Error('图片不存在'))
      }
      return
    }

    // 使用 S3 下载（使用用户隔离的 key）
    getPresignedUrl('GET', key, '', 3600)
      .then(res => {
        const url = res.url
        if (!url) {
          throw new Error('获取预签名 URL 失败')
        }

        wx.downloadFile({
          url,
          success: (downRes) => {
            if (downRes.statusCode >= 200 && downRes.statusCode < 300) {
              const tempPath = downRes.tempFilePath
              wx.setStorageSync(cacheKey, tempPath)
              resolve({ filePath: tempPath, fromCache: false })
            } else {
              // S3 下载失败，降级到本地存储
              console.warn('S3 下载失败，尝试本地存储')
              S3_CONFIG.enabled = false
              loadImage(key).then(resolve).catch(reject)
            }
          },
          fail: (err) => {
            // S3 下载失败，降级到本地存储
            console.warn('S3 下载失败，尝试本地存储')
            S3_CONFIG.enabled = false
            loadImage(key).then(resolve).catch(reject)
          }
        })
      })
      .catch(err => {
        // S3 不可用，降级到本地存储
        console.warn('S3 不可用，尝试本地存储:', err.message)
        S3_CONFIG.enabled = false
        loadImage(key).then(resolve).catch(reject)
      })
  })
}

/**
 * 生成 S3 URL (用于预览)
 * 自动使用用户隔离的 key
 */
function s3Url(key) {
  const userKey = getUserKey(key)
  return `${S3_CONFIG.endpoint}/${S3_CONFIG.bucket}/${userKey}`
}

/**
 * 获取请求头
 */
function s3Headers() {
  return {
    'User-Agent': S3_CONFIG.customUserAgent
  }
}

/**
 * 清除本地存储数据
 */
function clearLocalData() {
  wx.removeStorageSync(LOCAL_STORAGE_KEY)
}

/**
 * 获取本地存储数据大小
 */
function getLocalDataSize() {
  try {
    const data = wx.getStorageSync(LOCAL_STORAGE_KEY)
    if (data) {
      return new Blob([data]).size
    }
  } catch (err) {
    // 忽略
  }
  return 0
}

module.exports = {
  S3_CONFIG,
  isS3Enabled,
  getUserId,
  getUserKey,
  getOriginalKey,
  getPresignedUrl,
  uploadFile,
  loadJson,
  saveJson,
  loadImage,
  s3Url,
  s3Headers,
  clearLocalData,
  getLocalDataSize,
  getLocalData
}
