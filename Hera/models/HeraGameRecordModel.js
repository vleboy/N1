const moment = require('moment')
const _ = require('lodash')
const BaseModel = require('./BaseModel')
const { Tables } = require('../libs/Dynamo')
/**
 * 战绩表实体
 */
class HeraGameRecordModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: Tables.HeraGameRecord
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }

    /**
     * 单条写入注单战绩
     * @param {*} item 
     */
    async writeRound(item) {
        return this.putItem({
            userId: +item.userId,
            userName: item.userName,
            betId: item.businessKey,
            betTime: +item.createdAt,
            createdDate: moment(+item.createdAt).utcOffset(8).format('YYYY-MM-DD'),
            gameId: item.gameId ? item.gameId.toString() : item.gameType.toString(),
            gameType: +item.gameType,
            parentId: item.parent,
            status: item.status || 4,
            record: {
                content: item.content,
                anotherGameData: item.anotherGameData
            }
        })
    }

    /**
     * 线路商游戏记录查询
     */
    queryByManager(indexName, keys, queryParms) {
        //排除status=3的数据(这表示YSB未返奖的战绩，所以排除)
        queryParms.status = { "$not": 3 }
        let keyObj = this.buildParms(keys)
        let queryObj = this.buildParms(queryParms)
        let query = {
            TableName: this.params.TableName,
            ProjectionExpression: 'userName,betId,parentId,createdAt,betTime,#record,gameType,gameId,sourceIP',
            IndexName: indexName,
            ScanIndexForward: false, //降序返回结果
            KeyConditionExpression: keyObj.FilterExpression,
            FilterExpression: queryObj.FilterExpression,
            ExpressionAttributeNames: Object.assign(keyObj.ExpressionAttributeNames, queryObj.ExpressionAttributeNames, { '#record': 'record' }),
            ExpressionAttributeValues: Object.assign(keyObj.ExpressionAttributeValues, queryObj.ExpressionAttributeValues)
        }
        console.log(query)
        return this.query(query)
    }

    /**
     * 商户战绩分页查询
     */
    async queryParms(indexName, keys, queryParms, inparam = {}) {
        //排除status=3的数据(这表示YSB未返奖的战绩，所以排除)
        queryParms.status = { "$not": 3 }
        let keyObj = this.buildParms(keys)
        let queryObj = this.buildParms(queryParms)
        let query = {
            TableName: this.params.TableName,
            ProjectionExpression: 'userName,betId,parentId,createdAt,betTime,#record,gameType,gameId,sourceIP',
            IndexName: indexName,
            ScanIndexForward: false, //降序返回结果
            KeyConditionExpression: keyObj.FilterExpression,
            FilterExpression: queryObj.FilterExpression,
            Limit: 1000,//inparam.pageSize,
            ExpressionAttributeNames: Object.assign(keyObj.ExpressionAttributeNames, queryObj.ExpressionAttributeNames, { '#record': 'record' }),
            ExpressionAttributeValues: Object.assign(keyObj.ExpressionAttributeValues, queryObj.ExpressionAttributeValues)
        }
        if (inparam.lastKey) {
            query.ExclusiveStartKey = inparam.lastKey
        }
        console.log(query)
        return await this.forQueryRes(query, [], inparam.pageSize)
    }
    /**
     * 商户战绩分页查询，递归循环查询结果
     */
    async forQueryRes(query, array = [], pageSize = 20) {
        return this.db$('query', query).then((result) => {
            // 合并上一次的查询结果
            array = array.concat(result.Items)
            // 如果查询结果已经超过指定数量，则截取到指定数量返回
            if (array.length >= pageSize) {
                array = array.slice(0, pageSize)
                return [array, true]
            }
            // 没有查询到指定数量，且数据库还有剩余数据，则继续递归查询 
            else if (result.LastEvaluatedKey) {
                query.ExclusiveStartKey = result.LastEvaluatedKey
                return this.forQueryRes(query, array, pageSize)
            }
            // 没有查询到指定数量，且数据库没有剩余数据，则全部返回 
            else {
                return [array, false]
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

module.exports = HeraGameRecordModel