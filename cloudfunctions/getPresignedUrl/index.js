// cloudfunctions/getPresignedUrl/index.js
const crypto = require('crypto')

// S3 配置
const S3_CONFIG = {
  endpoint: 'https://s3.cstcloud.cn',
  bucket: 'timeline', // 替换为你的桶名
  region: 'us-east-1',
  accessKeyId: process.env.CST_AK,
  secretAccessKey: process.env.CST_SK
}

// 生成预签名 URL
function generatePresignedUrl(method, key, contentType = '', expiresIn = 900) {
  const algorithm = 'AWS4-HMAC-SHA256'
  const date = new Date().toISOString()
  const dateStr = date.slice(0, 10).replace(/-/g, '')
  const credentialScope = `${dateStr}/${S3_CONFIG.region}/s3/aws4_request`

  // 构造请求
  const host = new URL(S3_CONFIG.endpoint).host
  const resource = `/${S3_CONFIG.bucket}/${key}`

  // 构造查询参数
  const query = [
    `X-Amz-Algorithm=${algorithm}`,
    `X-Amz-Credential=${encodeURIComponent(S3_CONFIG.accessKeyId)}/${credentialScope}`,
    `X-Amz-Date=${date.replace(/[-:]/g, '').split('.')[0]}Z`,
    `X-Amz-Expires=${expiresIn}`,
    `X-Amz-SignedHeaders=host${contentType ? ';content-type' : ''}`
  ]

  // 构造规范请求
  const normalizedPath = key.replace(/\/+/g, '/')
  const canonicalUri = `/${S3_CONFIG.bucket}/${normalizedPath}`
  const canonicalQuery = query.join('&')
  const canonicalHeaders = `host:${host}\n${contentType ? `content-type:${contentType}\n` : ''}`
  const signedHeaders = `host${contentType ? ';content-type' : ''}`
  const payloadHash = crypto.createHash('sha256').update('UNSIGNED-PAYLOAD').digest('hex')

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n')

  // 计算签名
  const stringToSign = [
    algorithm,
    `${date.replace(/[-:]/g, '').split('.')[0]}Z`,
    credentialScope,
    crypto.createHash('sha256').update(canonicalRequest).digest('hex')
  ].join('\n')

  // 推导密钥
  const kDate = crypto.createHmac('sha256', 'AWS4' + S3_CONFIG.secretAccessKey)
    .update(dateStr).digest()
  const kRegion = crypto.createHmac('sha256', kDate).update(S3_CONFIG.region).digest()
  const kService = crypto.createHmac('sha256', kRegion).update('s3').digest()
  const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest()

  // 计算签名值
  const signature = crypto.createHmac('sha256', kSigning)
    .update(stringToSign).digest('hex')

  query.push(`X-Amz-Signature=${signature}`)

  return `${S3_CONFIG.endpoint}${resource}?${query.join('&')}`
}

// 云函数入口
exports.main = async (event, context) => {
  const { method, key, contentType = '', expiresIn = 900 } = event

  if (!method || !key) {
    return {
      success: false,
      error: '缺少必要参数'
    }
  }

  try {
    const url = generatePresignedUrl(method.toUpperCase(), key, contentType, expiresIn)
    return {
      success: true,
      url
    }
  } catch (err) {
    console.error('生成预签名 URL 失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}
