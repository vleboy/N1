const BaseModel = require('./BaseModel')
const config = require('config')
const _ = require('lodash')
class AdminModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: config.env.TABLE_NAMES.StatRound,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }
    //获取玩家一段时间所有数据
    async getAllRoundByName(indexName, queryParms, filterParms) {
        let queryObj = this.buildParms(queryParms)
        let filterObj = this.buildParms(filterParms)
        let query = {
            TableName: this.params.TableName,
            ProjectionExpression: ["businessKey", "betAmount", "gameType", "gameId", "retAmount", "userName", "rate", "createdAt", "originalAmount", "content", "winloseAmount"].join(','),
            ScanIndexForward: false, //降序返回结果
            KeyConditionExpression: queryObj.FilterExpression,
            ExpressionAttributeNames: Object.assign(queryObj.ExpressionAttributeNames, filterObj.ExpressionAttributeNames),
            ExpressionAttributeValues: Object.assign(queryObj.ExpressionAttributeValues, filterObj.ExpressionAttributeValues)
        }
        if (filterObj.FilterExpression) {
            query.FilterExpression = filterObj.FilterExpression
        }
        if (indexName) {
            query.IndexName = indexName
        }
        let res = await this.query(query)
        return res.Items
    }

    //获取玩家交易记录
    async getRoundByName(indexName, queryParms, filterParms, inparam) {
        let queryObj = this.buildParms(queryParms)
        let filterObj = this.buildParms(filterParms)
        let query = {
            TableName: this.params.TableName,
            ProjectionExpression: ["businessKey", "betAmount", "gameType", "gameId", "retAmount", "userName", "rate", "createdAt", "originalAmount", "content", "winloseAmount"].join(','),
            ScanIndexForward: false, //降序返回结果
            Limit: inparam.pageSize || 100,
            KeyConditionExpression: queryObj.FilterExpression,
            ExpressionAttributeNames: Object.assign(queryObj.ExpressionAttributeNames, filterObj.ExpressionAttributeNames),
            ExpressionAttributeValues: Object.assign(queryObj.ExpressionAttributeValues, filterObj.ExpressionAttributeValues)
        }
        if (filterObj.FilterExpression) {
            query.FilterExpression = filterObj.FilterExpression
        }
        if (inparam.startKey) {
            query.ExclusiveStartKey = inparam.startKey
        }
        if (indexName) {
            query.IndexName = indexName
        }
        return await this.forQueryRes(query, [], inparam.pageSize)
    }

    /**
    * 玩家交易记录分页查询，递归循环查询结果
    */
    async forQueryRes(query, array = [], pageSize = 100) {
        return this.db$('query', query).then((result) => {
            // 合并上一次的查询结果
            console.log(result.LastEvaluatedKey)
            array = array.concat(result.Items)
            // 如果查询结果已经超过指定数量，则截取到指定数量返回
            if (array.length >= pageSize) {
                array = array.slice(0, pageSize)
                return array
            }
            // 没有查询到指定数量，且数据库还有剩余数据，则继续递归查询 
            else if (result.LastEvaluatedKey) {
                query.ExclusiveStartKey = result.LastEvaluatedKey
                return this.forQueryRes(query, array, pageSize)
            }
            // 没有查询到指定数量，且数据库没有剩余数据，则全部返回 
            else {
                return array
            }
        }).catch((error) => {
            console.error(error)
        })
    }

    //参数解析和绑定
    buildParms(conditions) {
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
                        case "$not": {
                            opts.FilterExpression += `#${k} <> :${k}`;
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
        return opts
    }


}


module.exports = AdminModel