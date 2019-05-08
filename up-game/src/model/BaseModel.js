const AWS = require('aws-sdk')
AWS.config.update({ region: 'ap-southeast-1' })
const _ = require('lodash')
const moment = require('moment')
const dbClient = new AWS.DynamoDB.DocumentClient()

/**
 * 基础数据库操作类
 * putItem:插入单项
 * batchWrite:批量插入
 * updateItem:更新单项
 * deleteItem:删除单项
 * isExist:是否存在
 * queryOnce:单次查询
 * query:递归查询
 * scan:递归扫描
 * page:分页
 * bindFilterQuery:绑定筛选参数并查询
 * bindFilterScan:绑定筛选参数并扫描
 */
class BaseModel {
    /**
     * 构造方法，设置基础对象属性
     */
    constructor() {
        this.baseitem = {
            createdAt: Date.now(),
            updatedAt: Date.now(),
            createdDate: moment().utcOffset(8).format('YYYY-MM-DD'),
            createdStr: moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss')
        }
    }

    /**
     * 数据库操作流对象
     * @param {*} action 
     * @param {*} params 
     */
    db$(action, params) {
        return dbClient[action](params).promise()
    }

    /**
     * 插入单项
     * @param {*} item
     */
    putItem(item) {
        const params = {
            ...this.params,
            Item: {
                ...this.baseitem,
                ...item
            }
        }
        return this.db$('put', params)
    }

    /**
     * 批量插入
     * @param {*} batch
     */
    batchWrite(batch) {
        return this.db$('batchWrite', batch)
            .then((res) => {
                if (res.UnprocessedItems && !_.isEmpty(res.UnprocessedItems)) {
                    console.log('发生批量写入未完成事件')
                    // 遍历每个表
                    for (let tablename in res.UnprocessedItems) {
                        console.log(`表【${tablename}】未完成写入数据量:${res.UnprocessedItems[tablename].length}`)
                        // 初始化批量写入对象
                        let batch = {
                            RequestItems: {}
                        }
                        batch.RequestItems[tablename] = []
                        // 遍历每个表的每条数据
                        for (let item of res.UnprocessedItems[tablename]) {
                            batch.RequestItems[tablename].push(item)
                        }
                        // 重新插入
                        console.log(`表【${tablename}】重新写入数据量:${batch.RequestItems[tablename].length}`)
                        return this.batchWrite(batch)
                    }
                } else {
                    return res
                }
            }).catch((err) => {
                console.log(err)
            })
    }

    /**
     * 更新单项
     * @param {*} conditions 
     */
    updateItem(conditions) {
        const params = {
            ...this.params,
            ...conditions
        }
        return this.db$('update', params)
    }

    /**
     * 删除单项
     * @param {*} conditions 
     */
    deleteItem(conditions) {
        const params = {
            ...this.params,
            ...conditions
        }
        return this.db$('delete', params)
    }

    /**
     * 查询是否存在
     * @param {*} conditions 
     */
    isExist(conditions) {
        return new Promise((reslove, reject) => {
            const params = {
                ...this.params,
                ...conditions
            }
            return this.db$('query', params)
                .then((res) => {
                    const exist = res.Items.length > 0 ? true : false
                    return reslove(exist)
                }).catch((err) => {
                    return reject(err)
                })
        })
    }

    /**
     * 主键获取
     * @param {*} conditions 
     */
    getItem(conditions = {}) {
        const params = {
            ...this.params,
            ...conditions
        }
        return this.db$('get', params)
    }

    /**
     * 单次查询
     * @param {*} conditions 
     */
    queryOnce(conditions = {}) {
        const params = {
            ...this.params,
            ...conditions
        }
        return this.db$('query', params)
    }

    /**
     * 递归查询所有数据
     */
    query(conditions = {}) {
        const params = {
            ...this.params,
            ...conditions
        }
        return this.queryInc(params, null)
    }

    // 内部增量查询，用于结果集超过1M的情况
    queryInc(params, result) {
        return this.db$('query', params).then((res) => {
            if (!result) {
                result = res
            } else {
                result.Items.push(...res.Items)
            }
            if (res.LastEvaluatedKey) {
                params.ExclusiveStartKey = res.LastEvaluatedKey
                return this.queryInc(params, result)
            } else {
                return result
            }
        }).catch((err) => {
            return err
        })
    }

    /**
     * 全表查询数据
     */
    scan(conditions = {}) {
        const params = {
            ...this.params,
            ...conditions
        }
        return this.scanInc(params, null)
    }

    // 内部增量查询，用于结果集超过1M的情况
    scanInc(params, result) {
        return this.db$('scan', params).then((res) => {
            if (!result) {
                result = res
            } else {
                result.Items.push(...res.Items)
            }
            if (res.LastEvaluatedKey) {
                params.ExclusiveStartKey = res.LastEvaluatedKey
                return this.scanInc(params, result)
            } else {
                return result
            }
        }).catch((err) => {
            return err
        })
    }


    /**
     * 通过contentIds模糊查询
     * @param {*} id
     */
    async findIdsContains(id) {
        const ret = await this.scan({
            FilterExpression: 'contains(contentIds,:id)',
            ExpressionAttributeValues: {
                ':id': id
            }
        })
        if (ret.Items.length > 0) {
            return ret.Items
        } else {
            return 0
        }
    }

    /**
     * 分页查询
     * @param {*} query 
     * @param {*} inparam (limit,startKey)
     */
    async page(query, inparam) {
        // 初始化返回数据
        let pageData = { Items: [], LastEvaluatedKey: {} }
        inparam.limit = inparam.limit || inparam.pageSize
        // 查询数量不足且数据库仍有数据，则继续循环查询
        while (pageData.Items.length < inparam.limit && pageData.LastEvaluatedKey) {
            let ret = await this.queryOnce({
                ...query,
                Limit: inparam.limit,
                ExclusiveStartKey: inparam.startKey
            })
            // 追加数据
            if (pageData.Items.length > 0) {
                pageData.Items.push(...ret.Items)
            } else {
                pageData = ret
            }
            // 更新最后一条键值
            pageData.LastEvaluatedKey = ret.LastEvaluatedKey
            // 更新起始KEY
            inparam.startKey = ret.LastEvaluatedKey
            // 需要查询的数量减少
            inparam.limit -= ret.Items.length
        }
        // 最后查询键
        pageData.LastEvaluatedKey = _.pick(pageData.Items[pageData.Items.length - 1], inparam.lastEvaluatedKeyTemplate)
        // 最后数据超过指定长度，则截取指定长度
        // if (pageData.Items.length > inparam.limit) {
        //     pageData.Items = _.slice(pageData.Items, 0, inparam.limit)
        //     pageData.LastEvaluatedKey = _.pick(pageData.Items[pageData.Items.length - 1], inparam.LastEvaluatedKeyTemplate)
        // }
        return pageData
    }

    /**
     * 绑定筛选条件后查询
     * @param {*} oldquery 原始查询对象
     * @param {*} conditions 查询条件对象
     * @param {*} isDefault 是否默认全模糊搜索
     */
    bindFilterQuery(oldquery = {}, conditions = {}, isDefault) {
        if (_.isEmpty(oldquery)) {
            return
        }
        if (_.isEmpty(conditions)) {
            return this.query(oldquery)
        }
        // 默认设置搜索条件，所有查询模糊匹配
        if (isDefault) {
            for (let key in conditions) {
                if (!_.isArray(conditions[key])) {
                    conditions[key] = { '$like': conditions[key] }
                }
            }
        }
        let keys = Object.keys(conditions), opts = {}
        if (keys.length > 0) {
            opts.FilterExpression = ''
            opts.ExpressionAttributeValues = {}
            opts.ExpressionAttributeNames = {}
        }
        keys.forEach((k, index) => {
            let item = conditions[k]
            let value = item, array = false
            // 属性对应的值是数组，则直接用范围筛选
            if (_.isArray(item)) {
                opts.ExpressionAttributeNames[`#${k}`] = k
                opts.FilterExpression += `#${k} between :${k}0 and :${k}1`
                opts.ExpressionAttributeValues[`:${k}0`] = item[0]
                opts.ExpressionAttributeValues[`:${k}1`] = item[1]// + 86399999
            }
            else if (Object.is(typeof item, "object")) {
                for (let key in item) {
                    value = item[key]
                    switch (key) {
                        case "$like": {
                            opts.FilterExpression += `contains(#${k}, :${k})`
                            break
                        }
                        case "$in": {
                            array = true
                            opts.ExpressionAttributeNames[`#${k}`] = k
                            for (let i = 0; i < value.length; i++) {
                                if (i == 0) opts.FilterExpression += "("
                                opts.FilterExpression += `#${k} = :${k}${i}`
                                if (i != value.length - 1) {
                                    opts.FilterExpression += " or "
                                }
                                if (i == value.length - 1) {
                                    opts.FilterExpression += ")"
                                }
                                opts.ExpressionAttributeValues[`:${k}${i}`] = value[i]
                            }
                            break
                        }
                        case "$range": {
                            array = true
                            opts.ExpressionAttributeNames[`#${k}`] = k
                            opts.FilterExpression += `#${k} between :${k}0 and :${k}1`
                            opts.ExpressionAttributeValues[`:${k}0`] = value[0]
                            opts.ExpressionAttributeValues[`:${k}1`] = value[1]
                            break
                        }
                    }
                    break
                }
            } else {
                opts.FilterExpression += `#${k} = :${k}`
            }
            if (!array && !_.isArray(value)) {
                opts.ExpressionAttributeValues[`:${k}`] = value
                opts.ExpressionAttributeNames[`#${k}`] = k
            }
            if (index != keys.length - 1) opts.FilterExpression += " and "
        })

        // 绑定筛选至原来的查询对象
        if (oldquery.FilterExpression) {
            oldquery.FilterExpression += (' AND ' + opts.FilterExpression)
        } else {
            oldquery.FilterExpression = opts.FilterExpression
        }
        oldquery.ExpressionAttributeNames = { ...oldquery.ExpressionAttributeNames, ...opts.ExpressionAttributeNames }
        oldquery.ExpressionAttributeValues = { ...oldquery.ExpressionAttributeValues, ...opts.ExpressionAttributeValues }

        // 返回绑定筛选参数后的查询
        return this.query(oldquery)
    }

    /**
     * 绑定筛选条件后查询
     * @param {*} oldquery 原始查询对象
     * @param {*} conditions 查询条件对象
     * @param {*} isDefault 是否默认全模糊搜索
     */
    bindFilterPage(oldquery = {}, conditions = {}, isDefault, inparam) {
        if (_.isEmpty(oldquery)) {
            return
        }
        if (_.isEmpty(conditions)) {
            return this.query(oldquery)
        }
        // 默认设置搜索条件，所有查询模糊匹配
        if (isDefault) {
            for (let key in conditions) {
                if (!_.isArray(conditions[key])) {
                    conditions[key] = { '$like': conditions[key] }
                }
            }
        }
        let keys = Object.keys(conditions), opts = {}
        if (keys.length > 0) {
            opts.FilterExpression = ''
            opts.ExpressionAttributeValues = {}
            opts.ExpressionAttributeNames = {}
        }
        keys.forEach((k, index) => {
            let item = conditions[k]
            let value = item, array = false
            // 属性对应的值是数组，则直接用范围筛选
            if (_.isArray(item)) {
                opts.ExpressionAttributeNames[`#${k}`] = k
                opts.FilterExpression += `#${k} between :${k}0 and :${k}1`
                opts.ExpressionAttributeValues[`:${k}0`] = item[0]
                opts.ExpressionAttributeValues[`:${k}1`] = item[1]// + 86399999
            }
            else if (Object.is(typeof item, "object")) {
                for (let key in item) {
                    value = item[key]
                    switch (key) {
                        case "$like": {
                            opts.FilterExpression += `contains(#${k}, :${k})`
                            break
                        }
                        case "$in": {
                            array = true
                            opts.ExpressionAttributeNames[`#${k}`] = k
                            for (let i = 0; i < value.length; i++) {
                                if (i == 0) opts.FilterExpression += "("
                                opts.FilterExpression += `#${k} = :${k}${i}`
                                if (i != value.length - 1) {
                                    opts.FilterExpression += " or "
                                }
                                if (i == value.length - 1) {
                                    opts.FilterExpression += ")"
                                }
                                opts.ExpressionAttributeValues[`:${k}${i}`] = value[i]
                            }
                            break
                        }
                        case "$range": {
                            array = true
                            opts.ExpressionAttributeNames[`#${k}`] = k
                            opts.FilterExpression += `#${k} between :${k}0 and :${k}1`
                            opts.ExpressionAttributeValues[`:${k}0`] = value[0]
                            opts.ExpressionAttributeValues[`:${k}1`] = value[1]
                            break
                        }
                    }
                    break
                }
            } else {
                opts.FilterExpression += `#${k} = :${k}`
            }
            if (!array && !_.isArray(value)) {
                opts.ExpressionAttributeValues[`:${k}`] = value
                opts.ExpressionAttributeNames[`#${k}`] = k
            }
            if (index != keys.length - 1) opts.FilterExpression += " and "
        })

        // 绑定筛选至原来的查询对象
        if (oldquery.FilterExpression) {
            oldquery.FilterExpression += (' AND ' + opts.FilterExpression)
        } else {
            oldquery.FilterExpression = opts.FilterExpression
        }
        oldquery.ExpressionAttributeNames = { ...oldquery.ExpressionAttributeNames, ...opts.ExpressionAttributeNames }
        oldquery.ExpressionAttributeValues = { ...oldquery.ExpressionAttributeValues, ...opts.ExpressionAttributeValues }
        // 返回绑定筛选参数后的查询
        return this.page(oldquery, inparam)
    }

    /**
     * 绑定筛选条件后扫描
     * @param {*} oldquery 原始查询对象
     * @param {*} conditions 查询条件对象
     * @param {*} isDefault 是否默认全模糊搜索
     */
    bindFilterScan(oldquery = {}, conditions = {}, isDefault) {
        if (_.isEmpty(conditions)) {
            return this.scan(oldquery)
        }
        // 默认设置搜索条件，所有查询模糊匹配
        if (isDefault) {
            for (let key in conditions) {
                if (!_.isArray(conditions[key])) {
                    conditions[key] = { '$like': conditions[key] }
                }
            }
        }
        let keys = Object.keys(conditions), opts = {}
        if (keys.length > 0) {
            opts.FilterExpression = ''
            opts.ExpressionAttributeValues = {}
            opts.ExpressionAttributeNames = {}
        }
        keys.forEach((k, index) => {
            let item = conditions[k]
            let value = item, array = false
            if (_.isArray(item)) {
                opts.ExpressionAttributeNames[`#${k}`] = k
                opts.FilterExpression += `#${k} between :${k}0 and :${k}1`
                opts.ExpressionAttributeValues[`:${k}0`] = item[0]
                opts.ExpressionAttributeValues[`:${k}1`] = item[1]// + 86399999
            }
            else if (Object.is(typeof item, "object")) {
                for (let key in item) {
                    value = item[key]
                    switch (key) {
                        case "$like": {
                            opts.FilterExpression += `contains(#${k}, :${k})`
                            break
                        }
                        case "$in": {
                            array = true
                            opts.ExpressionAttributeNames[`#${k}`] = k
                            for (let i = 0; i < value.length; i++) {
                                if (i == 0) opts.FilterExpression += "("
                                opts.FilterExpression += `#${k} = :${k}${i}`
                                if (i != value.length - 1) {
                                    opts.FilterExpression += " or "
                                }
                                if (i == value.length - 1) {
                                    opts.FilterExpression += ")"
                                }
                                opts.ExpressionAttributeValues[`:${k}${i}`] = value[i]
                            }
                            break
                        }
                        case "$range": {
                            array = true
                            opts.ExpressionAttributeNames[`#${k}`] = k
                            opts.FilterExpression += `#${k} between :${k}0 and :${k}1`
                            opts.ExpressionAttributeValues[`:${k}0`] = value[0]
                            opts.ExpressionAttributeValues[`:${k}1`] = value[1]
                            break
                        }
                    }
                    break
                }
            } else {
                opts.FilterExpression += `#${k} = :${k}`
            }
            if (!array && !_.isArray(value)) {
                opts.ExpressionAttributeValues[`:${k}`] = value
                opts.ExpressionAttributeNames[`#${k}`] = k
            }
            if (index != keys.length - 1) opts.FilterExpression += " and "
        })

        // 绑定筛选至原来的查询对象
        if (oldquery.FilterExpression) {
            oldquery.FilterExpression += (' AND ' + opts.FilterExpression)
        } else {
            oldquery.FilterExpression = opts.FilterExpression
        }
        oldquery.ExpressionAttributeNames = { ...oldquery.ExpressionAttributeNames, ...opts.ExpressionAttributeNames }
        oldquery.ExpressionAttributeValues = { ...oldquery.ExpressionAttributeValues, ...opts.ExpressionAttributeValues }

        // 返回绑定筛选参数后的筛选
        return this.scan(oldquery)
    }
}

module.exports = BaseModel