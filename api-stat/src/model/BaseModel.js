const AWS = require('aws-sdk')
AWS.config.update({ region: 'ap-southeast-1' })
const _ = require('lodash')
const moment = require('moment')
const dynamoDb = new AWS.DynamoDB({ httpOptions: { timeout: 5000 } })
const dbClient = new AWS.DynamoDB.DocumentClient({ service: dynamoDb })

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
        return this.db$('put', params).then((res) => {
            return res
        }).catch((err) => {
            console.error(`表${params.TableName}写入失败，重新写入，以下是详细错误信息`)
            console.error(params)
            console.error(err)
            return this.putItem(item)
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
    
    // 生成SN
    billSerial(userId, num = 0) {
        let date = new Date();
        function twoNumber(num) {
            return num > 9 ? num + "" : "0" + num;
        }
        let timestramp = (date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds()) * 1000 + date.getMilliseconds() + "";
        for (let i = timestramp.length; i > 8; i--) {
            timestramp += "0" + timestramp;
        }
        date.setHours(date.getHours() + 8)
        return date.getFullYear() + twoNumber(date.getMonth() + 1) + twoNumber(date.getDate()) + userId + (timestramp + num)
    }
}

module.exports = BaseModel