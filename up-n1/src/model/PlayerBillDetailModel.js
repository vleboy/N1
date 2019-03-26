const GlobalConfig = require("../util/config")
const BaseModel = require('./BaseModel')
const _ = require('lodash')

class PlayerBillDetailModel extends BaseModel {
    constructor() {
        super()
        // 设置表名
        this.params = {
            TableName: GlobalConfig.TABLE_NAMES.PlayerBillDetail,
        }
        // 设置对象属性
        this.item = {
            ...this.baseitem
        }
    }
    //查询一段时间的流水
    async queryBillByTime(indexName, keyParms, filterParms) {
        let keyObj = this.buildParms(keyParms)
        let filterObj = this.buildParms(filterParms)
        let query = {
            TableName: this.params.TableName,
            ProjectionExpression: ["sn", "createdAt", "#type", "originalAmount", "amount", "balance", "businessKey", "remark", "betId", "userName", "billId", "id", "gameType", "gameId"].join(","),
            IndexName: indexName,
            ScanIndexForward: false, //降序返回结果
            KeyConditionExpression: keyObj.FilterExpression,
            ExpressionAttributeNames: Object.assign(keyObj.ExpressionAttributeNames, filterObj.ExpressionAttributeNames, { "#type": 'type' }),
            ExpressionAttributeValues: Object.assign(keyObj.ExpressionAttributeValues, filterObj.ExpressionAttributeValues)
        }
        return await this.query(query)
    }

    /**
    * 根据时间范围获取流水
    * @param {*} inparam 
    */
    async queryByTime(inparam) {
        return await this.query({
            IndexName: 'UserNameIndex',
            KeyConditionExpression: 'userName=:userName and createdAt > :startTime',
            ProjectionExpression: 'amount,createdAt,balance',
            ExpressionAttributeValues: {
                ':userName': inparam.userName,
                ':startTime': inparam.startTime,
            }
        })
    }

    /**
    * 玩家流水分页查询
    */
    async queryParms(indexName, keyParms, filterParms, inparam = {}) {
        let keyObj = this.buildParms(keyParms)
        let filterObj = this.buildParms(filterParms)
        let query = {
            TableName: this.params.TableName,
            ProjectionExpression: "sn,createdAt,#type,originalAmount,amount,balance,businessKey,remark,betId,userName,billId,id,gameType,gameId",
            IndexName: indexName,
            ScanIndexForward: false, //降序返回结果
            Limit: inparam.pageSize,
            KeyConditionExpression: keyObj.FilterExpression,
            ExpressionAttributeNames: Object.assign(keyObj.ExpressionAttributeNames, filterObj.ExpressionAttributeNames, { "#type": 'type' }),
            ExpressionAttributeValues: Object.assign(keyObj.ExpressionAttributeValues, filterObj.ExpressionAttributeValues)
        }
        if (filterObj.FilterExpression) {
            query.FilterExpression = filterObj.FilterExpression
        }
        if (inparam.startKey) {
            query.ExclusiveStartKey = inparam.startKey
        }
        console.log(query)
        return await this.forQueryRes(query, [], inparam.pageSize)
    }
    /**
     * 玩家流水分页查询，递归循环查询结果
     */
    async forQueryRes(query, array = [], pageSize = 20) {
        return this.db$('query', query).then((result) => {
            // 合并上一次的查询结果
            console.log(result.LastEvaluatedKey)
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

module.exports = PlayerBillDetailModel