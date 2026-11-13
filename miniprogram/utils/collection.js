/**
 * 合集管理工具
 */
const s3 = require('./s3')
const { loadJson, saveJson } = s3

const CACHE_KEY = 'timeline_cache_'

/**
 * 加载合集时间线
 */
function loadTimeline(collectionId) {
  const key = `collections/${collectionId}/timeline.json`
  return loadJson(key)
}

/**
 * 保存合集时间线
 */
function saveTimeline(collectionId, data) {
  const key = `collections/${collectionId}/timeline.json`
  return saveJson(key, data)
}

/**
 * 获取合集元数据
 */
function loadMeta(collectionId) {
  const key = `collections/${collectionId}/meta.json`
  return loadJson(key)
}

/**
 * 保存合集元数据
 */
function saveMeta(collectionId, data) {
  const key = `collections/${collectionId}/meta.json`
  return saveJson(key, data)
}

/**
 * 生成合集 ID
 */
function generateCollectionId() {
  const now = new Date()
  const timestamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14)
  const random = Math.random().toString(36).slice(2, 6)
  return `col_${timestamp}_${random}`
}

/**
 * 生成记录 ID
 */
function generateRecordId() {
  const now = new Date()
  const timestamp = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14)
  const random = Math.random().toString(36).slice(2, 5)
  return `rec_${timestamp}_${random}`
}

/**
 * 生成对位组 ID
 */
function generateAlignGroupId(collectionName, index = 1) {
  const prefix = collectionName.slice(0, 3).toLowerCase()
  return `ag_${prefix}_${String(index).padStart(3, '0')}`
}

/**
 * 获取合集列表
 */
function getCollectionList(manifest) {
  return manifest.collections || []
}

/**
 * 更新合集封面
 */
function updateCollectionCover(manifest, collectionId, thumbKey) {
  const collection = manifest.collections.find(c => c.id === collectionId)
  if (collection) {
    collection.coverKey = thumbKey
    collection.lastRecordAt = new Date().toISOString()
    collection.recordCount = (collection.recordCount || 0) + 1
  }
  return manifest
}

/**
 * 创建新合集
 */
function createCollection(name) {
  const id = generateCollectionId()
  const now = new Date().toISOString()
  return {
    id,
    name,
    createdAt: now,
    coverKey: null,
    recordCount: 0,
    lastRecordAt: now
  }
}

/**
 * 删除合集（从 manifest 中移除）
 */
function deleteCollection(manifest, collectionId) {
  manifest.collections = manifest.collections.filter(c => c.id !== collectionId)
  return manifest
}

module.exports = {
  loadTimeline,
  saveTimeline,
  loadMeta,
  saveMeta,
  generateCollectionId,
  generateRecordId,
  generateAlignGroupId,
  getCollectionList,
  updateCollectionCover,
  createCollection,
  deleteCollection
}
