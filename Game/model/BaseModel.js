const BizErr = require('../lib/Codes').BizErr
const Model = require('../lib/Dynamo').Model
const AWS = require('aws-sdk')
AWS.config.update({ region: 'ap-southeast-1' })
const dbClient = new AWS.DynamoDB.DocumentClient()
const _ = require('lodash')

module.exports = class BaseModel {
    /**
     * 构造方法，设置基础对象属性
     */
    constructor() {
        this.baseitem = Model.baseModel()
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
        return new Promise((reslove, reject) => {
            const params = {
                ...this.params,
                Item: {
                    ...this.baseitem,
                    ...item
                }
            }
            this.db$('put', params)
                .then((res) => {
                    return reslove([false, res])
                }).catch((err) => {
                    return reject([BizErr.DBErr(err.toString()), false])
                })
        })
    }

    /**
     * 批量插入
     * @param {*} batch
     */
    batchWrite(batch) {
        return this.db$('batchWrite', batch)
            .then((res) => {
                if (res.UnprocessedItems && !_.isEmpty(res.UnprocessedItems)) {
                    // console.log('发生批量写入未完成事件')
                    // 遍历每个表
                    for (let tablename in res.UnprocessedItems) {
                        // console.log(`表【${tablename}】未完成写入数据量:${res.UnprocessedItems[tablename].length}`)
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
                        // console.log(`表【${tablename}】重新写入数据量:${batch.RequestItems[tablename].length}`)
                        return this.batchWrite(batch)
                    }
                } else {
                    return [false, res]
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
        return new Promise((reslove, reject) => {
            const params = {
                ...this.params,
                ...conditions
            }
            this.db$('update', params)
                .then((res) => {
                    return reslove([false, res])
                }).catch((err) => {
                    return reject([BizErr.DBErr(err.toString()), false])
                })
        })
    }

    /**
     * 删除单项
     * @param {*} conditions 
     */
    deleteItem(conditions) {
        return new Promise((reslove, reject) => {
            const params = {
                ...this.params,
                ...conditions
            }
            this.db$('delete', params)
                .then((res) => {
                    return reslove([false, res])
                }).catch((err) => {
                    return reject([BizErr.DBErr(err.toString()), false])
                })
        })
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
            this.db$('query', params)
                .then((res) => {
                    let exist = false
                    if (res && !res.Items) { exist = true }
                    if (res && res.Items && res.Items.length > 0) { exist = true }
                    return reslove([0, exist])
                }).catch((err) => {
                    return reject([BizErr.DBErr(err.toString()), false])
                })
        })
    }

    /**
     * 单次查询
     * @param {*} conditions 
     */
    queryOnce(conditions = {}) {
        // return new Promise((reslove, reject) => {
        const params = {
            ...this.params,
            ...conditions
        }
        return this.db$('query', params)
        // .then((res) => {
        //     return reslove([0, res])
        // }).catch((err) => {
        //     return reject([BizErr.DBErr(err.message), false])
        // })
        // })
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
                return [false, result]
            }
        }).catch((err) => {
            return [BizErr.DBErr(err.toString()), false]
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
                return [false, result]
            }
        }).catch((err) => {
            return [BizErr.DBErr(err.toString()), false]
        })
    }

    /**
    * 绑定筛选条件
    * @param {*} oldquery 原始查询条件
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
            if (_.isArray(item)) {
                opts.FilterExpression += `${k} between :${k}0 and :${k}1`
                // opts.FilterExpression += `${k} > :${k}0 and ${k} < :${k}1`
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

        return this.query(oldquery)
    }

    /**
     * 绑定筛选条件
     * @param {*} oldquery 原始查询条件
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
                opts.FilterExpression += `${k} between :${k}0 and :${k}1`
                // opts.FilterExpression += `${k} > :${k}0 and ${k} < :${k}1`
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

        return this.scan(oldquery)
    }
}
